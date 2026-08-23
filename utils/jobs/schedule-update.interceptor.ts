import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';

/**
 * ScheduleHeartbeatService only recomputes nextRunAt when it's null or
 * already due - editing cronExpression/timeZone otherwise leaves a stale
 * nextRunAt (computed from the old cron) in place until it happens to fire.
 * Nulling it here makes the heartbeat's own "nextRunAt is null" branch
 * recompute it fresh on the next tick.
 */
@Injectable()
export class ScheduleUpdateInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { body } = context.switchToHttp().getRequest<Request>();

    if (body && typeof body === 'object' && ('cronExpression' in body || 'timeZone' in body)) {
      body.nextRunAt = null;
    }

    return next.handle();
  }
}
