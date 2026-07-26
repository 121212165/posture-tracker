import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { AssessmentStatus, AssessmentType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAssessmentDto extends PaginationDto {
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  /** 仅返回当前教练创建的评估，默认 false（同工作室所有教练可见） */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  mineOnly?: boolean;
}
