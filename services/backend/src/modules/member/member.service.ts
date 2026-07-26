import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { QueryMemberDto } from './dto/query-member.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class MemberService {
  constructor(private prisma: PrismaService) {}

  async create(studioId: string, dto: CreateMemberDto) {
    return this.prisma.member.create({
      data: {
        ...dto,
        studioId,
      },
    });
  }

  async findAll(studioId: string, query: QueryMemberDto): Promise<PaginatedResult<any>> {
    const { page = 1, pageSize = 20, keyword } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {
      studioId,
      deletedAt: null,
    };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { phone: { contains: keyword } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { assessments: true },
          },
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(studioId: string, id: string) {
    const member = await this.prisma.member.findFirst({
      where: { id, studioId, deletedAt: null },
      include: {
        _count: {
          select: { assessments: true },
        },
        assessments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { metrics: true },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('学员不存在');
    }

    return member;
  }

  async update(studioId: string, id: string, dto: UpdateMemberDto) {
    await this.findOne(studioId, id);

    return this.prisma.member.update({
      where: { id },
      data: dto,
    });
  }

  async remove(studioId: string, id: string) {
    await this.findOne(studioId, id);

    return this.prisma.member.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getAssessments(studioId: string, memberId: string) {
    await this.findOne(studioId, memberId);

    return this.prisma.assessment.findMany({
      where: { memberId, studioId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { metrics: true, report: true },
    });
  }
}
