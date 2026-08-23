import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ScheduleUpdateInterceptor } from '../schedule-update.interceptor';

describe('ScheduleUpdateInterceptor', () => {
  const interceptor = new ScheduleUpdateInterceptor();
  const mockCallHandler: CallHandler = { handle: () => of('result') };

  function makeContext(body: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ body }),
      }),
    } as ExecutionContext;
  }

  it('nulls nextRunAt when cronExpression changes', (done) => {
    const body: any = { cronExpression: '14 22 * * 2', nextRunAt: '2026-08-30T19:00:00.000Z' };

    interceptor.intercept(makeContext(body), mockCallHandler).subscribe(() => {
      expect(body.nextRunAt).toBeNull();
      done();
    });
  });

  it('nulls nextRunAt when timeZone changes', (done) => {
    const body: any = { timeZone: 'UTC' };

    interceptor.intercept(makeContext(body), mockCallHandler).subscribe(() => {
      expect(body.nextRunAt).toBeNull();
      done();
    });
  });

  it('leaves nextRunAt untouched for unrelated field updates', (done) => {
    const body: any = { active: false };

    interceptor.intercept(makeContext(body), mockCallHandler).subscribe(() => {
      expect(body.nextRunAt).toBeUndefined();
      done();
    });
  });

  it('handles a missing request body', (done) => {
    interceptor.intercept(makeContext(undefined), mockCallHandler).subscribe((result) => {
      expect(result).toBe('result');
      done();
    });
  });
});
