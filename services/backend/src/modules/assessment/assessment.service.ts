import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { QueryAssessmentDto } from './dto/query-assessment.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import axios from 'axios';
import { AssessmentStatus } from '@prisma/client';

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
    private configService: ConfigService,
  ) {}

  async create(coachId: string, studioId: string, dto: CreateAssessmentDto) {
    // 验证学员归属
    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, studioId, deletedAt: null },
    });

    if (!member) {
      throw new NotFoundException('学员不存在');
    }

    const assessment = await this.prisma.assessment.create({
      data: {
        studioId,
        coachId,
        memberId: dto.memberId,
        type: dto.type,
        photoFrontKey: dto.photoFrontKey,
        photoSideKey: dto.photoSideKey,
        status: AssessmentStatus.PROCESSING,
      },
      include: { member: true },
    });

    // 异步处理 AI 推理（带重试）
    this.processAssessmentWithRetry(
      assessment.id,
      dto.photoFrontKey,
      dto.photoSideKey,
    ).catch((err) => {
      this.logger.error(`Assessment ${assessment.id} ultimately failed: ${err.message}`);
    });

    return assessment;
  }

  async findAll(
    studioId: string,
    coachId: string,
    query: QueryAssessmentDto,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, pageSize = 20, memberId, status, type, mineOnly } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {
      studioId,
      deletedAt: null,
    };

    if (memberId) where.memberId = memberId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (mineOnly) where.coachId = coachId;

    const [items, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          member: { select: { id: true, name: true } },
          coach: { select: { id: true, name: true } },
          metrics: true,
        },
      }),
      this.prisma.assessment.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(studioId: string, id: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id, studioId, deletedAt: null },
      include: {
        member: true,
        coach: { select: { id: true, name: true } },
        metrics: true,
        report: true,
      },
    });

    if (!assessment) {
      throw new NotFoundException('评估记录不存在');
    }

    // 为小程序端生成图片签名 URL（内部系统路径，无需 studioId 校验）
    const [annotatedImageUrl, photoFrontUrl, photoSideUrl] = await Promise.all([
      assessment.annotatedImageKey
        ? this.fileService.getSignedUrl(assessment.annotatedImageKey)
        : Promise.resolve(null),
      assessment.photoFrontKey
        ? this.fileService.getSignedUrl(assessment.photoFrontKey)
        : Promise.resolve(null),
      assessment.photoSideKey
        ? this.fileService.getSignedUrl(assessment.photoSideKey)
        : Promise.resolve(null),
    ]);

    return {
      ...assessment,
      annotatedImageUrl,
      photoFrontUrl,
      photoSideUrl,
    };
  }

  async remove(studioId: string, id: string) {
    await this.findOne(studioId, id);

    return this.prisma.assessment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * 带重试的 AI 推理处理
   * - 网络超时/5xx 错误：最多重试 2 次（共 3 次尝试），指数退避
   * - 4xx 业务错误（POSE_NOT_DETECTED, PHOTO_QUALITY_LOW）：不重试
   */
  private async processAssessmentWithRetry(
    assessmentId: string,
    frontKey: string,
    sideKey: string,
  ) {
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.processAssessment(assessmentId, frontKey, sideKey);
        return;
      } catch (err) {
        const isNonRetryable = this.isNonRetryableError(err);
        const isLastAttempt = attempt === maxRetries;

        if (isNonRetryable || isLastAttempt) {
          await this.markAssessmentFailed(assessmentId, err);
          return;
        }

        const delayMs = 1000 * Math.pow(2, attempt);
        this.logger.warn(
          `Assessment ${assessmentId} attempt ${attempt + 1} failed, retrying in ${delayMs}ms: ${err.message}`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  /**
   * 判断错误是否不可重试（业务错误）
   */
  private isNonRetryableError(err: any): boolean {
    // AI 服务返回的业务错误（success: false）
    if (err.response?.data?.error_code) {
      return true;
    }
    // HTTP 4xx 错误不重试
    if (err.response?.status && err.response.status >= 400 && err.response.status < 500) {
      return true;
    }
    return false;
  }

  /**
   * 标记评估失败
   */
  private async markAssessmentFailed(assessmentId: string, err: any) {
    const errorCode = err.response?.data?.error_code;
    const errorMessage = errorCode
      ? `${errorCode}: ${err.response.data.error || err.message}`
      : err.message || 'AI 推理失败';

    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: AssessmentStatus.FAILED,
        errorMessage,
      },
    });

    this.logger.error(`Assessment ${assessmentId} marked FAILED: ${errorMessage}`);
  }

  private async processAssessment(assessmentId: string, frontKey: string, sideKey: string) {
    const aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') || 'http://ai-inference:8000';

    this.logger.log(`Processing assessment ${assessmentId}: front=${frontKey}, side=${sideKey}`);

    // 从 MinIO 获取图片
    const frontBuffer = await this.fileService.getFileBuffer(frontKey);
    const sideBuffer = await this.fileService.getFileBuffer(sideKey);

    // 调用 AI 推理服务
    const response = await axios.post(
      `${aiServiceUrl}/infer/pose`,
      {
        front_image: frontBuffer.toString('base64'),
        side_image: sideBuffer.toString('base64'),
      },
      {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const { success, keypoints, metrics, quality_score, annotated_image, error, error_code } =
      response.data;

    // AI 服务返回业务错误
    if (!success) {
      const bizError: any = new Error(error || 'AI 推理失败');
      bizError.response = {
        status: 200,
        data: { error_code, error },
      };
      throw bizError;
    }

    // 保存 metrics 到数据库
    await this.prisma.metrics.create({
      data: {
        assessmentId,
        shoulderRoundness: metrics.shoulder_roundness,
        headForward: metrics.head_forward,
        pelvicTilt: metrics.pelvic_tilt,
        shoulderDiff: metrics.shoulder_diff,
        kneeHyperextension: metrics.knee_hyperextension,
        overallScore: metrics.overall_score,
      },
    });

    // 上传标注图到 MinIO
    let annotatedImageKey: string | null = null;
    if (annotated_image) {
      annotatedImageKey = `assessments/${assessmentId}/annotated.png`;
      const annotatedBuffer = Buffer.from(annotated_image, 'base64');
      await this.fileService.uploadBuffer(annotatedImageKey, annotatedBuffer, 'image/png');
    }

    // 更新评估状态
    await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: AssessmentStatus.COMPLETED,
        keypointsJson: keypoints,
        qualityScore: quality_score,
        annotatedImageKey,
      },
    });

    this.logger.log(`Assessment ${assessmentId} completed successfully`);
  }

  async retry(studioId: string, id: string) {
    const assessment = await this.findOne(studioId, id);

    if (assessment.status !== AssessmentStatus.FAILED) {
      throw new BadRequestException('只能重试失败的评估');
    }

    await this.prisma.assessment.update({
      where: { id },
      data: {
        status: AssessmentStatus.PROCESSING,
        errorMessage: null,
      },
    });

    this.processAssessmentWithRetry(id, assessment.photoFrontKey, assessment.photoSideKey).catch(
      (err) => {
        this.logger.error(`Assessment ${id} retry ultimately failed: ${err.message}`);
      },
    );

    return { message: '评估正在重新处理中' };
  }
}
