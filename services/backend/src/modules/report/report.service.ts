import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileService } from '../file/file.service';
import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode';
import { chromium } from 'playwright';
import { renderReportHTML } from './pdf-template';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
    private configService: ConfigService,
  ) {}

  async generateReport(studioId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, studioId, deletedAt: null },
      include: {
        member: true,
        coach: { select: { id: true, name: true } },
        metrics: true,
        studio: true,
      },
    });

    if (!assessment) {
      throw new NotFoundException('评估记录不存在');
    }

    if (assessment.status !== 'COMPLETED') {
      throw new BadRequestException('评估尚未完成，无法生成报告');
    }

    if (!assessment.metrics) {
      throw new BadRequestException('评估指标缺失，无法生成报告');
    }

    // 检查是否已有报告
    const existingReport = await this.prisma.report.findUnique({
      where: { assessmentId },
    });

    if (existingReport) {
      return existingReport;
    }

    const shareToken = nanoid(32);
    const h5BaseUrl = this.configService.get<string>('H5_BASE_URL') || 'http://localhost:3001';
    const h5Url = `${h5BaseUrl}/report/${shareToken}`;

    // 生成二维码
    const qrCodeBuffer = await QRCode.toBuffer(h5Url, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const qrCodeKey = `reports/${assessmentId}/qrcode.png`;
    await this.fileService.uploadBuffer(qrCodeKey, qrCodeBuffer, 'image/png');
    const qrCodeUrl = await this.fileService.getSignedUrl(qrCodeKey);

    // 生成PDF报告
    const pdfBuffer = await this.generatePDF(assessment);
    const pdfKey = `reports/${assessmentId}/report.pdf`;
    await this.fileService.uploadBuffer(pdfKey, pdfBuffer, 'application/pdf');
    const pdfUrl = await this.fileService.getSignedUrl(pdfKey);

    const report = await this.prisma.report.create({
      data: {
        assessmentId,
        h5Url,
        pdfUrl: pdfKey,
        qrCodeUrl: qrCodeKey,
        shareToken,
      },
    });

    this.logger.log(`Report generated for assessment ${assessmentId}`);

    return {
      ...report,
      pdfUrl,
      qrCodeUrl,
    };
  }

  async getReportByShareToken(shareToken: string) {
    const report = await this.prisma.report.findUnique({
      where: { shareToken },
      include: {
        assessment: {
          include: {
            member: true,
            coach: { select: { id: true, name: true } },
            metrics: true,
            studio: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('报告不存在');
    }

    // 公开接口：无需 studioId 校验，但只对内部系统路径（reports/, assessments/）生成签名 URL
    const [pdfUrl, qrCodeUrl, annotatedImageUrl, photoFrontUrl, photoSideUrl] = await Promise.all([
      report.pdfUrl ? this.fileService.getSignedUrl(report.pdfUrl) : Promise.resolve(null),
      this.fileService.getSignedUrl(report.qrCodeUrl),
      report.assessment.annotatedImageKey
        ? this.fileService.getSignedUrl(report.assessment.annotatedImageKey)
        : Promise.resolve(null),
      report.assessment.photoFrontKey
        ? this.fileService.getSignedUrl(report.assessment.photoFrontKey)
        : Promise.resolve(null),
      report.assessment.photoSideKey
        ? this.fileService.getSignedUrl(report.assessment.photoSideKey)
        : Promise.resolve(null),
    ]);

    return {
      ...report,
      pdfUrl,
      qrCodeUrl,
      assessment: {
        ...report.assessment,
        annotatedImageUrl,
        photoFrontUrl,
        photoSideUrl,
      },
    };
  }

  async getReport(studioId: string, assessmentId: string) {
    const report = await this.prisma.report.findUnique({
      where: { assessmentId },
    });

    if (!report) {
      throw new NotFoundException('报告尚未生成');
    }

    // 验证归属
    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, studioId },
    });

    if (!assessment) {
      throw new NotFoundException('评估记录不存在');
    }

    // 生成新的签名URL（内部系统路径无需 studioId 校验）
    const [pdfUrl, qrCodeUrl, annotatedImageUrl, photoFrontUrl, photoSideUrl] = await Promise.all([
      report.pdfUrl ? this.fileService.getSignedUrl(report.pdfUrl) : Promise.resolve(null),
      this.fileService.getSignedUrl(report.qrCodeUrl),
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
      ...report,
      pdfUrl,
      qrCodeUrl,
      annotatedImageUrl,
      photoFrontUrl,
      photoSideUrl,
    };
  }

  private async generatePDF(assessment: any): Promise<Buffer> {
    const html = renderReportHTML(assessment);

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
