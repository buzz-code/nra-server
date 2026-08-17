import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MailWebhookGuard } from '../mail-webhook.guard';

describe('MailWebhookGuard', () => {
  let guard: MailWebhookGuard;
  const originalSecret = process.env.MAIL_WEBHOOK_SECRET;

  const contextWithHeader = (headers: Record<string, string>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new MailWebhookGuard();
  });

  afterEach(() => {
    process.env.MAIL_WEBHOOK_SECRET = originalSecret;
  });

  it('passes through when MAIL_WEBHOOK_SECRET is not configured', () => {
    delete process.env.MAIL_WEBHOOK_SECRET;
    expect(guard.canActivate(contextWithHeader({}))).toBe(true);
  });

  it('rejects when the secret is configured but missing from the request', () => {
    process.env.MAIL_WEBHOOK_SECRET = 'shh';
    expect(() => guard.canActivate(contextWithHeader({}))).toThrow(UnauthorizedException);
  });

  it('rejects when the secret does not match', () => {
    process.env.MAIL_WEBHOOK_SECRET = 'shh';
    expect(() => guard.canActivate(contextWithHeader({ 'x-webhook-secret': 'wrong' }))).toThrow(UnauthorizedException);
  });

  it('passes when the secret matches', () => {
    process.env.MAIL_WEBHOOK_SECRET = 'shh';
    expect(guard.canActivate(contextWithHeader({ 'x-webhook-secret': 'shh' }))).toBe(true);
  });
});
