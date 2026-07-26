import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TrendService } from './trend.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('trends')
@UseGuards(JwtAuthGuard)
export class TrendController {
  constructor(private readonly trendService: TrendService) {}

  @Get('members/:memberId')
  getMemberTrend(
    @CurrentUser() user: CurrentUserPayload,
    @Param('memberId') memberId: string,
  ) {
    return this.trendService.getMemberTrend(user.studioId, memberId);
  }

  @Get('studio-overview')
  getStudioOverview(@CurrentUser() user: CurrentUserPayload) {
    return this.trendService.getStudioOverview(user.studioId);
  }
}
