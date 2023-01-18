import { Injectable } from '@nestjs/common';
import { EntityService as UsersService } from 'src/entity-modules/user.module';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from './constants';
import * as cookie from 'cookie';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) { }

  async validateUser(username: string, pass: string): Promise<any> {
    if (`${username}:${pass}` === process.env.ADMIN_USER) {
      return {
        id: -1,
        name: 'admin',
        permissions: JSON.stringify({ admin: true })
      }
    }

    const user = await this.usersService.findOne({ where: { email: username } });
    if (user) {
      const passwordMatch = await bcrypt.compare(pass, user.password);
      if (passwordMatch) {
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async getCookieWithJwtToken(user: any) {
    const payload = {
      username: user.email,
      id: user.id,
      effective_id: user.effective_id,
      name: user.name,
      permissions: JSON.parse(user.permissions || '{}')
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
