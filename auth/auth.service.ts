import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '@shared/entities/User.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from './constants';
import * as cookie from 'cookie';

type UserForCookie = Partial<Omit<User, 'password'> & { impersonated?: boolean }>;

const adminUser = {
  id: -1,
  name: 'admin',
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
        return this.getUserForCookie(user);
      }
    }
    return null;
  }

  private getUserForCookie(user: User): UserForCookie {
    const { password, ...result } = user;
    return result;
  }

  async registerUser(username: string, pass: string, userInfo: any): Promise<any> {
    const existingUser = await this.userRepository.findOne({ where: { email: username } });
    if (existingUser) {
      throw new UnauthorizedException('כתובת המייל כבר רשומה במערכת');
    }
    const userToCreate = this.userRepository.create({
      name: userInfo?.name ?? username,
      email: username,
      password: pass,
      permissions: {},
      userInfo,
    });
    const user = await this.userRepository.save(userToCreate);
    return this.getUserForCookie(user);
  }

  async getCookieWithJwtToken(user: UserForCookie) {
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

  async getCookieForLogOut(user?: UserForCookie) {
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
    const userForCookie = this.getUserForCookie(user);
    userForCookie.impersonated = true
    return this.getCookieWithJwtToken(userForCookie);
  }
}

export function getUserIdFromUser(user: User) {
  if (!user) return undefined;
  if (user.permissions.admin) return undefined;
  return user.effective_id || user.id;
}
