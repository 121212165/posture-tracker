import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TrendService {
  constructor(private prisma: PrismaService) {}

  async getMemberTrend(studioId: string, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, studioId, deletedAt: null },
    });

    if (!member) {
      throw new NotFoundException('学员不存在');
    }

    const assessments = await this.prisma.assessment.findMany({
      where: {
        memberId,
        studioId,
        deletedAt: null,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'asc' },
      include: { metrics: true },
      take: 20,
    });

    if (assessments.length === 0) {
      return {
        member: { id: member.id, name: member.name },
        trend: [],
        summary: { totalAssessments: 0 },
      };
    }

    const trend = assessments.map((a) => ({
      assessmentId: a.id,
      date: a.createdAt,
      type: a.type,
      metrics: a.metrics
        ? {
            overallScore: a.metrics.overallScore,
            shoulderRoundness: a.metrics.shoulderRoundness,
            headForward: a.metrics.headForward,
            pelvicTilt: a.metrics.pelvicTilt,
            shoulderDiff: a.metrics.shoulderDiff,
            kneeHyperextension: a.metrics.kneeHyperextension,
          }
        : null,
    }));

    // 计算改善趋势
    const summary: any = {
      totalAssessments: assessments.length,
      firstAssessment: assessments[0]?.createdAt,
      latestAssessment: assessments[assessments.length - 1]?.createdAt,
    };

    if (assessments.length >= 2) {
      const first = assessments[0].metrics;
      const latest = assessments[assessments.length - 1].metrics;

      if (first && latest) {
        summary.improvement = {
          overallScore: latest.overallScore - first.overallScore,
          shoulderRoundness: first.shoulderRoundness - latest.shoulderRoundness, // 值降低=改善
          headForward: first.headForward - latest.headForward,
          pelvicTilt: first.pelvicTilt - latest.pelvicTilt,
          shoulderDiff: first.shoulderDiff - latest.shoulderDiff,
          kneeHyperextension: first.kneeHyperextension - latest.kneeHyperextension,
        };
      }
    }

    return {
      member: { id: member.id, name: member.name },
      trend,
      summary,
    };
  }

  async getStudioOverview(studioId: string) {
    const [totalMembers, totalAssessments, recentAssessments] = await Promise.all([
      this.prisma.member.count({
        where: { studioId, deletedAt: null },
      }),
      this.prisma.assessment.count({
        where: { studioId, deletedAt: null },
      }),
      this.prisma.assessment.findMany({
        where: { studioId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          member: { select: { id: true, name: true } },
          metrics: { select: { overallScore: true } },
        },
      }),
    ]);

    const completedAssessments = await this.prisma.assessment.count({
      where: { studioId, deletedAt: null, status: 'COMPLETED' },
    });

    return {
      totalMembers,
      totalAssessments,
      completedAssessments,
      recentAssessments,
    };
  }
}
