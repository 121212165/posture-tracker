import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FileService } from '../file/file.service';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
    private configService: ConfigService,
  ) {}

  @Get()
  async check() {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        minio: 'unknown',
        aiService: 'unknown',
      },
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      status.services.database = 'ok';
    } catch (e) {
      status.services.database = 'error';
      status.status = 'degraded';
    }

    try {
      const minioOk = await this.fileService.checkHealth();
      status.services.minio = minioOk ? 'ok' : 'error';
      if (!minioOk) {
        status.status = 'degraded';
      }
    } catch (e) {
      status.services.minio = 'error';
      status.status = 'degraded';
    }

    try {
      const aiUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://ai-inference:8000';
      await axios.get(`${aiUrl}/health`, { timeout: 3000 });
      status.services.aiService = 'ok';
    } catch (e) {
      status.services.aiService = 'error';
      status.status = 'degraded';
    }

    return status;
  }
}
