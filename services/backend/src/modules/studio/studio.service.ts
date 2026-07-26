import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class StudioService {
  constructor(private prisma: PrismaService) {}

  async getStudio(studioId: string) {
    return this.prisma.studio.findUnique({
      where: { id: studioId },
    });
  }

  async updateStudio(studioId: string, data: { name?: string; logoUrl?: string; contactPhone?: string; address?: string }) {
    return this.prisma.studio.update({
      where: { id: studioId },
      data,
    });
  }
}
