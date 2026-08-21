import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpServer, HttpStatus } from '@nestjs/common';

/**
 * Backstop exception filter: guarantees every unhandled exception - not just
 * the ones LoggerErrorInterceptor sees - has its real error attached to the
 * response before pino-http logs it.
 *
 * pino-http already logs its own per-request line at error level whenever
 * res.statusCode >= 500, with req.id and (thanks to LoggerErrorInterceptor
 * setting response.err) the full exception + stack. That covers exceptions
 * thrown in a handler. It does NOT cover exceptions thrown by a guard or
 * middleware, since those never reach the interceptor - pino-http still logs
 * at error level for those, but with a generic synthetic error, losing the
 * real cause. This filter sets response.err itself so that never happens,
 * without adding a second, duplicate log line - no custom tag needed, filter
 * on res.statusCode>=500 same as always.
 *
 * Response body/status for HttpExceptions is passed through unchanged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapter: HttpServer) { }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    if (status >= 500 && !response.err) {
      response.err = exception;
    }

    this.httpAdapter.reply(response, body, status);
  }
}
