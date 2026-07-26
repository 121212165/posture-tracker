import { Controller, Get, Param } from '@nestjs/common';
import { ReportService } from './report.service';

@Controller('share')
export class ShareController {
  constructor(private readonly reportService: ReportService) {}

  @Get('reports/:shareToken')
  async getSharedReport(@Param('shareToken') shareToken: string) {
    const report = await this.reportService.getReportByShareToken(shareToken);
    return report;
  }
}
