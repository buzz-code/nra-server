import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '@shared/entities/User.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from './constants';
import * as cookie from 'cookie';
import { ReportMonth } from 'src/db/entities/ReportMonth.entity';
import { getCurrentHebrewYear, getCurrentYearMonths } from '../utils/entity/year.util';
import { IAuthenticatedUser } from './auth.types';

const adminUser: IAuthenticatedUser = {
  id: -1,
  name: 'admin',
  email: 'admin',
  permissions: { admin: true }
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService
  ) { }

  async validateUser(username: string, pass: string): Promise<any> {
    if (`${username}:${pass}` === process.env.ADMIN_USER) {
      return adminUser
    }

    const user = await this.userRepository.findOne({ where: { email: username } });
    if (user) {
      const passwordMatch = await bcrypt.compare(pass, user.password);
      if (passwordMatch) {
        return this.getSafeUserDetails(user);
      }
    }
    return null;
  }

  private getSafeUserDetails(user: User): IAuthenticatedUser {
    const { password, ...result } = user;
    return result;
  }

  async registerUser(username: string, pass: string, userInfo: any): Promise<any> {
    const existingUser = await this.userRepository.findOne({ where: { email: username } });
    if (existingUser) {
      throw new UnauthorizedException('כתובת המייל כבר רשומה במערכת');
    }
    const userToCreate = this.userRepository.create({
      name: userInfo?.organizationName ?? username,
      email: username,
      password: pass,
      permissions: {},
      userInfo,
    });
    const user = await this.userRepository.save(userToCreate);
    await this.generateDataForNewUser(user);
    return this.getSafeUserDetails(user);
  }

  async getCookieWithJwtToken(user: IAuthenticatedUser) {
    const payload = {
      username: user.email,
      id: user.id,
      effective_id: user.effective_id,
      name: user.name,
      permissions: user.permissions || {},
      impersonated: user.impersonated,
    };
    const token = this.jwtService.sign(payload);
    return cookie.serialize('Authentication', token, {
      httpOnly: true,
      path: '/',
      maxAge: jwtConstants.maxAge,
      sameSite: true,
    });
  }

  async getCookieForLogOut(user?: IAuthenticatedUser) {
    if (!user?.impersonated) {
      return cookie.serialize('Authentication', '', {
        httpOnly: true,
        path: '/',
        maxAge: 0,
        sameSite: true
      });
    } else {
      return this.getCookieWithJwtToken(adminUser);
    }
  }

  async getCookieForImpersonate(userId: number) {
    const user = await this.userRepository.findOneBy({ id: userId })
    const userForCookie = this.getSafeUserDetails(user);
    userForCookie.impersonated = true
    return this.getCookieWithJwtToken(userForCookie);
  }

  async generateDataForNewUser(user: User) {
    try {
      const formatter = new Intl.DateTimeFormat('he', { month: 'long' });
      const reportMonths: Partial<ReportMonth>[] = getCurrentYearMonths()
        .map(monthStartDate => ({
          userId: user.id,
          name: formatter.format(monthStartDate),
          startDate: monthStartDate,
          endDate: new Date(monthStartDate.getFullYear(), monthStartDate.getMonth() + 1, 0),
          year: getCurrentHebrewYear()
        }))
      await this.userRepository.manager.getRepository(ReportMonth).save(reportMonths);
    } catch (e) {
      console.log('error generating data for new user', e);
    }
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }
    return this.getSafeUserDetails(user);
  }

  async updateSettings(userId: number, data: any) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }

    user.additionalData = {
      ...user.additionalData,
      ...data
    };

    await this.userRepository.update(user.id, { additionalData: user.additionalData });
    return { success: true };
  }
}
