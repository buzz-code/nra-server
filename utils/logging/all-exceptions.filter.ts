import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpServer, HttpStatus } from '@nestjs/common';

/**
 * Catches every unhandled exception (handler, guard, pipe, or middleware) and
 * attaches it to the response as response.err before replying, so pino-http's
 * own per-request log line - which already fires at error level whenever
 * res.statusCode>=500, and reads response.err into it - carries the real
 * error and stack for every 500, regardless of where it was thrown.
 * No custom tag/log line needed: filter on res.statusCode>=500.
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

    if (status >= 500) {
      response.err = exception;
    }

    this.httpAdapter.reply(response, body, status);
  }
}
