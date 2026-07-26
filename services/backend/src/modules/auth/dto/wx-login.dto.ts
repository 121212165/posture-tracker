import { IsOptional, IsString } from 'class-validator';

export class WxLoginDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  nickName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
