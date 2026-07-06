import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  UnauthorizedException,
  Post,
  Patch,
  Request,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AuthService } from '@shared/auth/auth.service';
import { JwtAuthGuard } from '@shared/auth/jwt-auth.guard';
import { LocalAuthGuard } from '@shared/auth/local-auth.guard';
import { Response } from 'express';
import { LocalRegisterAuthGuard } from '@shared/auth/local-register-auth.guard';
import { getUserIdFromUser } from '@shared/auth/auth.util';
import { isAdmin } from '@shared/utils/permissionsUtil';
import { AuthenticatedRequest } from '@shared/auth/auth.types';
import { SkipMaintenance } from '@shared/decorators/skip-maintenance.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private authService: AuthService,
  ) { }

  @UseGuards(LocalAuthGuard)
  @Post('auth/login')
  @HttpCode(200)
  async login(@Request() req: AuthenticatedRequest, @Res() response: Response) {
    const cookie = await this.authService.getCookieWithJwtToken(req.user);
    response.setHeader('Set-Cookie', cookie);
    return response.send({ success: true });
  }

  @UseGuards(LocalRegisterAuthGuard)
  @Post('auth/register')
  @HttpCode(200)
  async register(@Request() req: AuthenticatedRequest, @Res() response: Response) {
    const cookie = await this.authService.getCookieWithJwtToken(req.user);
    response.setHeader('Set-Cookie', cookie);
    return response.send({ success: true });
  }

  @Post('auth/logout')
  async logOut(@Res() response: Response) {
    const cookie = await this.authService.getCookieForLogOut();
    response.setHeader('Set-Cookie', cookie);
    return response.sendStatus(200);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: AuthenticatedRequest) {
    const userId = getUserIdFromUser(req.user, true);
    if (!userId) {
      return req.user;
    }
    const user = await this.authService.getProfile(userId);
    return Object.assign({}, req.user, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('auth/impersonate')
  async impersonate(@Request() req: AuthenticatedRequest, @Res() response: Response) {
    const userId = Number(req.body?.userId);
    if (!isAdmin(req.user)) {
      throw new UnauthorizedException();
    }
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('Invalid userId');
    }
    const cookie = await this.authService.getCookieForImpersonate(userId);
    response.setHeader('Set-Cookie', cookie);
    return response.send({ success: true });
  }

  @UseGuards(JwtAuthGuard)
  @Post('auth/unimpersonate')
  async unimpersonate(@Request() req: AuthenticatedRequest, @Res() response: Response) {
    const cookie = await this.authService.getCookieForLogOut(req.user);
    response.setHeader('Set-Cookie', cookie);
    return response.sendStatus(200);
  }

  @UseGuards(JwtAuthGuard)
  @Post('settings')
  async updateSettings(@Request() req: AuthenticatedRequest, @Body() data: any) {
    const userId = getUserIdFromUser(req.user);
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.authService.updateSettings(userId, data);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req: AuthenticatedRequest, @Body() data: { phoneNumber?: string }) {
    const userId = getUserIdFromUser(req.user);
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.authService.updateProfile(userId, data);
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @SkipMaintenance()
  @Get('health')
  @HttpCode(200)
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
