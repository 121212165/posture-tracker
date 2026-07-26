import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import axios from 'axios';
import { WxLoginDto } from './dto/wx-login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async wxLogin(dto: WxLoginDto) {
    let openid: string;
    let unionid: string | undefined;

    const wxAppid = this.configService.get<string>('WX_APPID');
    const wxSecret = this.configService.get<string>('WX_SECRET');

    if (!wxAppid || wxAppid === 'your_wx_appid' || dto.code.startsWith('test_')) {
      openid = dto.code.startsWith('test_') ? dto.code : `test_coach_${Date.now()}`;
      this.logger.log(`Using mock openid for development: ${openid}`);
    } else {
      try {
        const wxResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
          params: {
            appid: wxAppid,
            secret: wxSecret,
            js_code: dto.code,
            grant_type: 'authorization_code',
          },
        });

        if (wxResponse.data.errcode) {
          throw new BadRequestException(`微信登录失败: ${wxResponse.data.errmsg}`);
        }

        openid = wxResponse.data.openid;
        unionid = wxResponse.data.unionid;
      } catch (error) {
        if (error.response) {
          throw new BadRequestException('微信登录失败，请检查AppID配置');
        }
        openid = `test_${dto.code}`;
        this.logger.warn(`WeChat API failed, using fallback openid: ${openid}`);
      }
    }

    let coach = await this.prisma.coach.findUnique({
      where: { openid },
      include: { studio: true },
    });

    if (!coach) {
      const studio = await this.prisma.studio.create({
        data: {
          name: '我的普拉提工作室',
        },
      });

      coach = await this.prisma.coach.create({
        data: {
          openid,
          unionid,
          name: dto.nickName || '教练',
          avatarUrl: dto.avatarUrl,
          role: 'OWNER',
          studioId: studio.id,
        },
        include: { studio: true },
      });

      this.logger.log(`Created new coach and studio: ${coach.id}, ${studio.id}`);
    } else if (dto.nickName || dto.avatarUrl) {
      coach = await this.prisma.coach.update({
        where: { id: coach.id },
        data: {
          name: dto.nickName || coach.name,
          avatarUrl: dto.avatarUrl || coach.avatarUrl,
        },
        include: { studio: true },
      });
    }

    const token = this.jwtService.sign({
      coachId: coach.id,
      studioId: coach.studioId,
      role: coach.role,
      openid: coach.openid,
    });

    return {
      token,
      coach: {
        id: coach.id,
        name: coach.name,
        avatarUrl: coach.avatarUrl,
        role: coach.role,
      },
      studio: {
        id: coach.studio.id,
        name: coach.studio.name,
        logoUrl: coach.studio.logoUrl,
        plan: coach.studio.plan,
      },
    };
  }

  async getCurrentUser(coachId: string) {
    const coach = await this.prisma.coach.findUnique({
      where: { id: coachId },
      include: { studio: true },
    });

    if (!coach) {
      throw new BadRequestException('用户不存在');
    }

    return {
      coach: {
        id: coach.id,
        name: coach.name,
        avatarUrl: coach.avatarUrl,
        role: coach.role,
      },
      studio: {
        id: coach.studio.id,
        name: coach.studio.name,
        logoUrl: coach.studio.logoUrl,
        plan: coach.studio.plan,
      },
    };
  }
}
