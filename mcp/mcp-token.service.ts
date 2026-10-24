import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { User } from '@shared/entities/User.entity';
import { IAuthenticatedUser } from '@shared/auth/auth.types';
import { isAdmin } from '@shared/utils/permissionsUtil';

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');

/**
 * Temporary per-user bearer token for `/mcp`, until the OAuth flow lands.
 * Token format is `<userId>.<secret>`; only the secret's sha256 is stored, in `user.additionalData.mcpTokenHash`.
 * Admins and impersonated sessions never get a token, so a token always maps to exactly one user.
 */
@Injectable()
export class McpTokenService {
  constructor(@InjectRepository(User) private userRepository: Repository<User>) {}

  async issueToken(authUser: IAuthenticatedUser): Promise<string> {
    if (!authUser?.id || isAdmin(authUser) || authUser.impersonated) {
      throw new ForbiddenException('MCP access is available to regular users only');
    }
    const user = await this.userRepository.findOneBy({ id: authUser.id });
    if (!user) {
      throw new ForbiddenException('User not found');
    }
    const secret = randomBytes(24).toString('hex');
    await this.userRepository.update(user.id, {
      additionalData: { ...user.additionalData, mcpTokenHash: hash(secret) },
    });
    return `${user.id}.${secret}`;
  }

  async resolveUserId(token: string | undefined): Promise<number | null> {
    const match = /^(\d+)\.([0-9a-f]{48})$/.exec(token ?? '');
    if (!match) return null;
    const user = await this.userRepository.findOneBy({ id: Number(match[1]) });
    const stored = user?.additionalData?.mcpTokenHash;
    if (!stored || isAdmin(user)) return null;
    const given = Buffer.from(hash(match[2]));
    return timingSafeEqual(given, Buffer.from(stored)) ? user.id : null;
  }
}
