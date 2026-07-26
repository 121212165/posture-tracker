import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { QueryAssessmentDto } from './dto/query-assessment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('assessments')
@UseGuards(JwtAuthGuard)
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateAssessmentDto) {
    return this.assessmentService.create(user.coachId, user.studioId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryAssessmentDto) {
    return this.assessmentService.findAll(user.studioId, user.coachId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.assessmentService.findOne(user.studioId, id);
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.assessmentService.retry(user.studioId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.assessmentService.remove(user.studioId, id);
  }
}
