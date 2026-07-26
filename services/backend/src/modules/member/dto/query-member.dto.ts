import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryMemberDto extends PaginationDto {
  @IsOptional()
  @IsString()
  keyword?: string;
}
