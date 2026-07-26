import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  controllers: [HealthController],
})
export class HealthModule {}
