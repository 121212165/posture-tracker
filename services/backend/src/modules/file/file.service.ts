import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { nanoid } from 'nanoid';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private minioClient: Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const endPoint = (this.configService.get<string>('MINIO_ENDPOINT') || 'localhost:9000').split(':');
    this.minioClient = new Client({
      endPoint: endPoint[0],
      port: parseInt(endPoint[1] || '9000'),
      useSSL: this.configService.get<string>('MINIO_SECURE') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY') || 'minioadmin',
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY') || 'minioadmin',
    });
    this.bucketName = this.configService.get<string>('MINIO_BUCKET') || 'posture-tracker';
    this.initBucket();
  }

  private async initBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        this.logger.log(`Bucket ${this.bucketName} created`);
      }
    } catch (e) {
      this.logger.error(`Failed to init bucket: ${e.message}`);
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    studioId: string,
  ): Promise<{ objectKey: string; url: string }> {
    const ext = originalName.split('.').pop() || 'jpg';
    // objectKey 前缀注入 studioId，用于后续归属校验
    const objectKey = `studios/${studioId}/${nanoid()}.${ext}`;

    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      buffer,
      buffer.length,
      { 'Content-Type': mimetype },
    );

    return {
      objectKey,
      url: await this.getSignedUrl(objectKey),
    };
  }

  /**
   * 校验 objectKey 归属指定 studio，防止跨工作室越权访问
   * 规则：objectKey 必须以 `studios/{studioId}/` 开头，或属于内部系统路径
   * (assessments/{id}/, reports/{id}/)——后者已通过 studioId 在 service 层校验
   */
  private assertObjectKeyBelongsToStudio(objectKey: string, studioId: string): void {
    const allowedPrefixes = [
      `studios/${studioId}/`,
      // 内部系统路径：assessment/report 由 service 层 findOne 时按 studioId 过滤
      'assessments/',
      'reports/',
    ];
    const isAllowed = allowedPrefixes.some((prefix) => objectKey.startsWith(prefix));
    if (!isAllowed) {
      throw new BadRequestException('无权访问该文件');
    }
  }

  async getSignedUrl(
    objectKey: string,
    expirySeconds: number = 3600,
    studioId?: string,
  ): Promise<string> {
    if (studioId) {
      this.assertObjectKeyBelongsToStudio(objectKey, studioId);
    }
    return await this.minioClient.presignedGetObject(this.bucketName, objectKey, expirySeconds);
  }

  async getFileBuffer(objectKey: string, studioId?: string): Promise<Buffer> {
    if (studioId) {
      this.assertObjectKeyBelongsToStudio(objectKey, studioId);
    }
    try {
      const dataStream = await this.minioClient.getObject(this.bucketName, objectKey);
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        dataStream.on('data', (chunk) => chunks.push(chunk));
        dataStream.on('end', () => resolve(Buffer.concat(chunks)));
        dataStream.on('error', reject);
      });
    } catch (e) {
      throw new BadRequestException('文件不存在或无法访问');
    }
  }

  async uploadBuffer(objectKey: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      buffer,
      buffer.length,
      { 'Content-Type': contentType },
    );
  }

  /**
   * 健康检查：验证 MinIO 可达且 bucket 可访问
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.minioClient.bucketExists(this.bucketName);
      return true;
    } catch (e) {
      this.logger.error(`MinIO health check failed: ${e.message}`);
      return false;
    }
  }
}
