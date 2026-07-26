import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MemberService } from './member.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { QueryMemberDto } from './dto/query-member.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateMemberDto) {
    return this.memberService.create(user.studioId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryMemberDto) {
    return this.memberService.findAll(user.studioId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.memberService.findOne(user.studioId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.memberService.update(user.studioId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.memberService.remove(user.studioId, id);
  }

  @Get(':id/assessments')
  getAssessments(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.memberService.getAssessments(user.studioId, id);
  }
}
