import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpServer, HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

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
    // DB table name -> API resource name (e.g. 'report_groups' -> 'report_group'), so a
    // foreign key violation can be traced back to the resource blocking the delete. The
    // client, which already has Hebrew resource labels, maps this to a friendly message.
    private readonly tableNameToResourceName: Record<string, string> = {},
  ) { }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (isForeignKeyViolation(exception)) {
      const table = getReferencingTable(exception);
      const resource = (table && this.tableNameToResourceName[table]) || table;
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
