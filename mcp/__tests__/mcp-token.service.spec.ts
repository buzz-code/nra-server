import { ForbiddenException } from '@nestjs/common';
import { McpTokenService } from '../mcp-token.service';

describe('McpTokenService', () => {
  let users: Record<number, any>;
  let service: McpTokenService;

  beforeEach(() => {
    users = {
      5: { id: 5, permissions: {}, additionalData: { yemotWebhookToken: 'keep' } },
      9: { id: 9, permissions: { admin: true }, additionalData: {} },
    };
    const repo: any = {
      findOneBy: jest.fn(async ({ id }) => users[id] ?? null),
      update: jest.fn(async (id, patch) => Object.assign(users[id], patch)),
    };
    service = new McpTokenService(repo);
  });

  it('issues a token that resolves to its user and keeps other additionalData', async () => {
    const token = await service.issueToken({ id: 5, email: 'a', name: 'a', permissions: {} });
    expect(token).toMatch(/^5\.[0-9a-f]{48}$/);
    expect(users[5].additionalData.yemotWebhookToken).toBe('keep');
    expect(users[5].additionalData.mcpTokenHash).not.toContain(token.split('.')[1]);
    expect(await service.resolveUserId(token)).toBe(5);
  });

  it('invalidates the previous token on rotation', async () => {
    const first = await service.issueToken({ id: 5, email: 'a', name: 'a', permissions: {} });
    await service.issueToken({ id: 5, email: 'a', name: 'a', permissions: {} });
    expect(await service.resolveUserId(first)).toBeNull();
  });

  it('refuses admins and impersonated sessions', async () => {
    await expect(service.issueToken({ id: 9, email: 'b', name: 'b', permissions: { admin: true } })).rejects.toThrow(ForbiddenException);
    await expect(service.issueToken({ id: 5, email: 'a', name: 'a', permissions: {}, impersonated: true })).rejects.toThrow(ForbiddenException);
  });

  it('rejects malformed, unknown and forged tokens', async () => {
    const token = await service.issueToken({ id: 5, email: 'a', name: 'a', permissions: {} });
    expect(await service.resolveUserId(undefined)).toBeNull();
    expect(await service.resolveUserId('garbage')).toBeNull();
    expect(await service.resolveUserId(token.replace(/^5/, '77'))).toBeNull();
    expect(await service.resolveUserId(`5.${'0'.repeat(48)}`)).toBeNull();
  });
});
