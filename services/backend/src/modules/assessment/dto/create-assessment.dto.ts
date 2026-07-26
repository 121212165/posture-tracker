import { IsString, IsOptional, IsEnum } from 'class-validator';
import { AssessmentType } from '@prisma/client';

export class CreateAssessmentDto {
  @IsString()
  memberId: string;

  @IsEnum(AssessmentType)
  type: AssessmentType;

  @IsString()
  photoFrontKey: string;

  @IsString()
  photoSideKey: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
