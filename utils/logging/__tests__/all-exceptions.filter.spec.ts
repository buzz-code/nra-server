import { BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exceptions.filter';

function buildHost(response: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => response,
    }),
  } as any;
}

describe('AllExceptionsFilter', () => {
  it('attaches a non-HttpException to response.err (for pino-http to log) and replies 500', () => {
    const httpAdapter = { reply: jest.fn() };
    const filter = new AllExceptionsFilter(httpAdapter as any);
    const error = new Error('boom');
    const response: any = {};

    filter.catch(error, buildHost(response));

    expect(response.err).toBe(error);
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      { statusCode: 500, message: 'Internal server error' },
      500,
    );
  });

  it('does not overwrite response.err already set by LoggerErrorInterceptor', () => {
    const httpAdapter = { reply: jest.fn() };
    const filter = new AllExceptionsFilter(httpAdapter as any);
    const originalError = new Error('original');
    const response: any = { err: originalError };

    filter.catch(new Error('later'), buildHost(response));

    expect(response.err).toBe(originalError);
  });

  it('does not attach err for a 4xx HttpException, and passes its response body through', () => {
    const httpAdapter = { reply: jest.fn() };
    const filter = new AllExceptionsFilter(httpAdapter as any);
    const exception = new BadRequestException('bad input');
    const response: any = {};

    filter.catch(exception, buildHost(response));

    expect(response.err).toBeUndefined();
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      exception.getResponse(),
      400,
    );
  });
});
