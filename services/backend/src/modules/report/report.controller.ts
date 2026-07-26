import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('assessments/:assessmentId')
  generateReport(
    @CurrentUser() user: CurrentUserPayload,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.reportService.generateReport(user.studioId, assessmentId);
  }

  @Get('assessments/:assessmentId')
  getReport(
    @CurrentUser() user: CurrentUserPayload,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.reportService.getReport(user.studioId, assessmentId);
  }
}
