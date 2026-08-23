import { TypeOrmPinoLogger } from '../typeorm-pino.logger';

describe('TypeOrmPinoLogger', () => {
  it('logs a query at log level', () => {
    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const ormLogger = new TypeOrmPinoLogger(logger as any);

    ormLogger.logQuery('SELECT 1', [1]);

    expect(logger.log).toHaveBeenCalledWith({ query: 'SELECT 1', parameters: [1] }, 'query');
  });

  it('logs a query error at error level', () => {
    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const ormLogger = new TypeOrmPinoLogger(logger as any);
    const error = new Error('boom');

    ormLogger.logQueryError(error, 'SELECT 1', []);

    expect(logger.error).toHaveBeenCalledWith({ query: 'SELECT 1', parameters: [], err: error }, 'query error');
  });

  it('logs a slow query at warn level', () => {
    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const ormLogger = new TypeOrmPinoLogger(logger as any);

    ormLogger.logQuerySlow(500, 'SELECT 1', []);

    expect(logger.warn).toHaveBeenCalledWith({ query: 'SELECT 1', parameters: [], time: 500 }, 'slow query');
  });

  it('routes log(warn) to warn and other levels to log', () => {
    const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const ormLogger = new TypeOrmPinoLogger(logger as any);

    ormLogger.log('warn', 'careful');
    ormLogger.log('info', 'fyi');

    expect(logger.warn).toHaveBeenCalledWith('careful');
    expect(logger.log).toHaveBeenCalledWith('fyi');
  });
});
