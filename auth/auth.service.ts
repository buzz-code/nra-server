import { Injectable, UnauthorizedException, Inject, Optional, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Not, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { User } from '@shared/entities/User.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { jwtConstants } from './constants';
import * as cookie from 'cookie';
import { IAuthenticatedUser } from './auth.types';
import { getYemotLegacyRouteDeadline } from '@shared/utils/yemot/yemot-legacy-route.util';
import { IUserInitializationService, USER_INITIALIZATION_SERVICE } from './user-initialization.interface';
import { mailWorkflowUrls } from '@shared/config/mail-workflows';

const MAIL_ALIAS_REGEX = /^[a-z0-9._-]{3,64}$/;
// Default sender used when a user has no alias - must never be claimed by a single user
const RESERVED_MAIL_ALIASES = ['test'];

export interface UpdateProfileData {
  phoneNumber?: string;
  mailAddressTitle?: string;
  mailAddressAlias?: string;
}

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
    private jwtService: JwtService,
    private httpService: HttpService,
    @Optional() @Inject(USER_INITIALIZATION_SERVICE) private userInitService?: IUserInitializationService
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
    
    if (this.userInitService) {
      await this.userInitService.initializeUserData(user);
    } else {
      console.warn('No user initialization service provided, skipping data generation for new user');
    }
    
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
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const userForCookie = this.getSafeUserDetails(user);
    userForCookie.impersonated = true;
    return this.getCookieWithJwtToken(userForCookie);
  }

  async getProfile(userId: number) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.additionalData?.yemotWebhookToken) {
      user.additionalData = {
        ...user.additionalData,
        yemotWebhookToken: randomBytes(16).toString('hex'),
      };
      await this.userRepository.update(user.id, { additionalData: user.additionalData });
    }

    // Computed, not persisted - keeps it out of additionalData so a client
    // updateSettings call can't accidentally echo a stale value back.
    return {
      ...this.getSafeUserDetails(user),
      yemotLegacyRouteDeadline: getYemotLegacyRouteDeadline()?.toISOString() ?? null,
    };
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

  async updateProfile(userId: number, data: UpdateProfileData) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }

    const update: Partial<User> = {};
    if (data.phoneNumber !== undefined) {
      update.phoneNumber = data.phoneNumber;
    }
    if (data.mailAddressTitle !== undefined) {
      update.mailAddressTitle = data.mailAddressTitle?.trim() || null;
    }
    if (data.mailAddressAlias !== undefined) {
      const alias = data.mailAddressAlias?.trim().toLowerCase() || null;
      if (alias && alias !== user.mailAddressAlias) {
        await this.validateMailAddressAlias(userId, alias);
      }
      update.mailAddressAlias = alias;
    }

    if (Object.keys(update).length) {
      await this.userRepository.update(user.id, update);
    }
    return { success: true };
  }

  private async validateMailAddressAlias(userId: number, alias: string) {
    if (!MAIL_ALIAS_REGEX.test(alias)) {
      throw new BadRequestException('כתובת המייל אינה תקינה - יש להשתמש באותיות באנגלית, מספרים, נקודה, מקף או קו תחתון (3-64 תווים)');
    }

    if (RESERVED_MAIL_ALIASES.includes(alias)) {
      throw new BadRequestException('כתובת המייל כבר תפוסה');
    }

    const existingUser = await this.userRepository.findOne({ where: { mailAddressAlias: alias, id: Not(userId) } });
    if (existingUser) {
      throw new BadRequestException('כתובת המייל כבר תפוסה');
    }

    let isValid: boolean;
    try {
      const { data } = await firstValueFrom(this.httpService.post(mailWorkflowUrls.validateMailQnique, { alias }));
      isValid = Boolean(data?.valid);
    } catch (e) {
      console.log('could not validate mail alias uniqueness', e);
      throw new ServiceUnavailableException('לא ניתן לבדוק את כתובת המייל כרגע, נסו שוב מאוחר יותר');
    }
    if (!isValid) {
      throw new BadRequestException('כתובת המייל כבר תפוסה');
    }
  }
}
