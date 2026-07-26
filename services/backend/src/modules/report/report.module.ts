import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { ShareController } from './share.controller';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  controllers: [ReportController, ShareController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
