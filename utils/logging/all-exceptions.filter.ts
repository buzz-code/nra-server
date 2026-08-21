import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpServer, HttpStatus } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Request } from 'express';

/**
 * Backstop exception filter: guarantees every unhandled exception (not just the
 * ones nestjs-pino's LoggerErrorInterceptor sees) is logged, and every 5xx is
 * logged at error level with the full stack, request id and a stable
 * event:"server_error" tag so it can be found/alerted on in one place
 * regardless of which status code it came out as.
 *
 * Response body/status for HttpExceptions is passed through unchanged - this
 * only adds logging on top of Nest's normal exception handling.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapter: HttpServer,
    private readonly logger: Logger,
  ) { }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { id?: string; user?: { id?: number } }>();
    const response = ctx.getResponse();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    if (status >= 500) {
      this.logger.error(
        {
          event: 'server_error',
          requestId: request?.id,
          method: request?.method,
          path: request?.originalUrl ?? request?.url,
          userId: request?.user?.id,
          err: exception,
        },
        exception instanceof Error ? exception.message : 'Unhandled exception',
      );
    }

    this.httpAdapter.reply(response, body, status);
  }
}
