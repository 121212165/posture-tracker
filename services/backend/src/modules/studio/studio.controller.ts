import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { StudioService } from './studio.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('studio')
@UseGuards(JwtAuthGuard)
export class StudioController {
  constructor(private readonly studioService: StudioService) {}

  @Get()
  async getStudio(@CurrentUser() user: CurrentUserPayload) {
    return this.studioService.getStudio(user.studioId);
  }

  @Patch()
  async updateStudio(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { name?: string; logoUrl?: string; contactPhone?: string; address?: string },
  ) {
    return this.studioService.updateStudio(user.studioId, body);
  }
}
