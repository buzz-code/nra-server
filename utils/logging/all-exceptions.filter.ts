import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpServer, HttpStatus } from '@nestjs/common';
import { snakeCase } from 'change-case';
import { DataSource, QueryFailedError } from 'typeorm';

// MySQL: deleting a row that another table still has a foreign key to.
const FK_VIOLATION_CODE = 'ER_ROW_IS_REFERENCED_2';

function isForeignKeyViolation(exception: unknown): exception is QueryFailedError {
  return exception instanceof QueryFailedError && (exception as any).driverError?.code === FK_VIOLATION_CODE;
}

function getReferencingTable(exception: QueryFailedError): string | null {
  // sqlMessage looks like: "... foreign key constraint fails (`db`.`report_groups`, CONSTRAINT ...)"
  const match = /\(`[^`]+`\.`([^`]+)`/.exec((exception as any).driverError?.sqlMessage || '');
  return match?.[1] || null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapter: HttpServer,
    private readonly dataSource?: DataSource,
  ) { }

  // DB table name (e.g. 'report_groups') -> API resource name (e.g. 'report_group'), the same
  // snakeCase(entityName) convention BaseEntityModule uses for controller paths - resolved
  // lazily, only for the one table involved, when a violation actually occurs.
  private resolveResourceName(table: string | null): string | null {
    const metadata = table && this.dataSource?.entityMetadatas.find((m) => m.tableName === table);
    return (metadata && snakeCase(metadata.targetName)) || table;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (isForeignKeyViolation(exception)) {
      const resource = this.resolveResourceName(getReferencingTable(exception));
      const label = resource?.replace(/_/g, ' ') || 'רשומות אחרות';
      const body = {
        statusCode: HttpStatus.CONFLICT,
        message: `לא ניתן למחוק רשומה זו - קיימות רשומות מסוג "${label}" המשויכות אליה. יש למחוק אותן תחילה.`,
        resource,
      };
      this.httpAdapter.reply(response, body, HttpStatus.CONFLICT);
      return;
    }

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
