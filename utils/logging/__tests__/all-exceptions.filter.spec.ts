import { BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exceptions.filter';

function buildHost(request: any) {
  const response = {};
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as any;
}

describe('AllExceptionsFilter', () => {
  it('logs a non-HttpException as a server error and replies 500', () => {
    const logger = { error: jest.fn() };
    const httpAdapter = { reply: jest.fn() };
    const filter = new AllExceptionsFilter(httpAdapter as any, logger as any);
    const error = new Error('boom');
    const request = { id: 'req-1', method: 'GET', originalUrl: '/things', user: { id: 7 } };

    filter.catch(error, buildHost(request));

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'server_error',
        requestId: 'req-1',
        method: 'GET',
        path: '/things',
        userId: 7,
        err: error,
      }),
      'boom',
    );
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      {},
      { statusCode: 500, message: 'Internal server error' },
      500,
    );
  });

  it('does not log a 4xx HttpException, and passes its response body through', () => {
    const logger = { error: jest.fn() };
    const httpAdapter = { reply: jest.fn() };
    const filter = new AllExceptionsFilter(httpAdapter as any, logger as any);
    const exception = new BadRequestException('bad input');
    const request = { id: 'req-2', method: 'POST', originalUrl: '/things' };

    filter.catch(exception, buildHost(request));

    expect(logger.error).not.toHaveBeenCalled();
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      {},
      exception.getResponse(),
      400,
    );
  });
});
