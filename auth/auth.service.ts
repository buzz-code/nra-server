import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '@shared/entities/User.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from './constants';
import * as cookie from 'cookie';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService
  ) { }

  async validateUser(username: string, pass: string): Promise<any> {
    if (`${username}:${pass}` === process.env.ADMIN_USER) {
      return {
        id: -1,
        name: 'admin',
        permissions: { admin: true }
      }
    }

    const user = await this.userRepository.findOne({ where: { email: username } });
    if (user) {
      const passwordMatch = await bcrypt.compare(pass, user.password);
      if (passwordMatch) {
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async registerUser(username: string, pass: string): Promise<any> {
    const existingUser = await this.userRepository.findOne({ where: { email: username } });
    if (existingUser) {
      throw new UnauthorizedException('כתובת המייל כבר רשומה במערכת');
    }
    const user = await this.userRepository.create({
      name: username,
      email: username,
      password: pass,
      permissions: {},
    });
    const { password, ...result } = user;
    return result;
  }

  async getCookieWithJwtToken(user: any) {
    const payload = {
      username: user.email,
      id: user.id,
      effective_id: user.effective_id,
      name: user.name,
      permissions: user.permissions || {}
    };
    const token = this.jwtService.sign(payload);
    return cookie.serialize('Authentication', token, {
      httpOnly: true,
      path: '/',
      maxAge: jwtConstants.maxAge,
      sameSite: true,
      domain: '.' + process.env.DOMAIN_NAME,
    });
  }

  public getCookieForLogOut() {
    return cookie.serialize('Authentication', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
      sameSite: true
    });
  }
}
