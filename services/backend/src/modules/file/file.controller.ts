import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Get,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('未上传文件');
    }
    return this.fileService.uploadFile(file.buffer, file.originalname, file.mimetype, user.studioId);
  }

  @Get(':objectKey/signed-url')
  async getSignedUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectKey') objectKey: string,
  ) {
    const url = await this.fileService.getSignedUrl(objectKey, 3600, user.studioId);
    return { url };
  }
}
