import { Logger as PinoLogger } from 'nestjs-pino';
import { Logger as TypeOrmLogger } from 'typeorm';

export class TypeOrmPinoLogger implements TypeOrmLogger {
  constructor(private readonly logger: PinoLogger) { }

  logQuery(query: string, parameters?: unknown[]) {
    this.logger.log({ query, parameters }, 'query');
  }

  logQueryError(error: string | Error, query: string, parameters?: unknown[]) {
    this.logger.error({ query, parameters, err: error }, 'query error');
  }

  logQuerySlow(time: number, query: string, parameters?: unknown[]) {
    this.logger.warn({ query, parameters, time }, 'slow query');
  }

  logSchemaBuild(message: string) {
    this.logger.log(message);
  }

  logMigration(message: string) {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown) {
    if (level === 'warn') {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}
