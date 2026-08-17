import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Protects the inbound-mail webhook (`POST /:entity/handle-email`).
 * That route is called by our n8n mail-routing workflow, not a logged-in
 * user, so it stays outside JwtAuthGuard (@Public()) and is secured with a
 * shared secret instead.
 *
 * If MAIL_WEBHOOK_SECRET isn't configured on a deployment yet, the guard
 * passes everything through rather than locking the route before it's set up.
 */
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
