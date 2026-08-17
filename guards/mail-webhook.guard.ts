import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

// Secures the n8n-called handle-email webhook via a shared secret header.
// No-op if MAIL_WEBHOOK_SECRET isn't set yet on a deployment.
@Injectable()
export class MailWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredSecret = process.env.MAIL_WEBHOOK_SECRET;
    if (!requiredSecret) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const providedSecret = request.headers['x-webhook-secret'];

    if (providedSecret !== requiredSecret) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
