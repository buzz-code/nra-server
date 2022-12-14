import { Injectable } from '@nestjs/common';
import { EntityService as UsersService } from 'src/entity-modules/user.module';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

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
    if (user && bcrypt.compareSync(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      username: user.email,
      id: user.id,
      effective_id: user.effective_id,
      name: user.name,
      permissions: JSON.parse(user.permissions || '{}')
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
