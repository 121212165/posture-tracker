import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudioModule } from './modules/studio/studio.module';
import { MemberModule } from './modules/member/member.module';
import { FileModule } from './modules/file/file.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { ReportModule } from './modules/report/report.module';
import { TrendModule } from './modules/trend/trend.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    StudioModule,
    MemberModule,
    FileModule,
    AssessmentModule,
    ReportModule,
    TrendModule,
    HealthModule,
  ],
})
export class AppModule {}
