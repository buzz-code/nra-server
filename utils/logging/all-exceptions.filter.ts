import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpServer, HttpStatus, Logger } from '@nestjs/common';
import { snakeCase } from 'change-case';
import { DataSource, QueryFailedError } from 'typeorm';
import { getTranslatedProperty } from '@shared/utils/validation/class-validator-he';

// MySQL: deleting a row that another table still has a foreign key to.
const FK_VIOLATION_CODE = 'ER_ROW_IS_REFERENCED_2';

function isForeignKeyViolation(exception: unknown): exception is QueryFailedError {
  return exception instanceof QueryFailedError && (exception as any).driverError?.code === FK_VIOLATION_CODE;
}

// MySQL: a value that cannot be converted to the column's type, e.g. a filter of
// `reportDate||$gte||20236-10-03` or `klassReferenceId||$eq||hj`. The value came from the
// request, so this is a client error, not a server one.
const INVALID_VALUE_CODES = new Set([
  'ER_TRUNCATED_WRONG_VALUE', // 1292: Incorrect date value / Truncated incorrect DOUBLE value
  'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', // 1366: Incorrect integer value
  'ER_WRONG_VALUE', // 1525: Incorrect DATE value
  'ER_WARN_DATA_OUT_OF_RANGE', // 1264: Out of range value
]);

function isInvalidValue(exception: unknown): exception is QueryFailedError {
  return exception instanceof QueryFailedError && INVALID_VALUE_CODES.has((exception as any).driverError?.code);
}

// sqlMessage looks like: "Incorrect integer value: 'hj' for column 'klass_reference_id' at row 1".
// Either part may be missing ("Out of range value for column 'id'", "Incorrect DATE value: '20236-10-03'").
function getInvalidValueDetails(exception: QueryFailedError): { value: string | null; column: string | null } {
  const sqlMessage = (exception as any).driverError?.sqlMessage || '';
  return {
    value: /value: '([^']*)'/.exec(sqlMessage)?.[1] ?? null,
    column: /for column '([^']+)'/.exec(sqlMessage)?.[1] ?? null,
  };
}

function getReferencingTable(exception: QueryFailedError): string | null {
  // sqlMessage looks like: "... foreign key constraint fails (`db`.`report_groups`, CONSTRAINT ...)"
  const match = /\(`[^`]+`\.`([^`]+)`/.exec((exception as any).driverError?.sqlMessage || '');
  return match?.[1] || null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

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

  // DB column name (e.g. 'klass_reference_id') -> entity property (e.g. 'klassReferenceId'),
  // the name the client filters by.
  private resolveFieldName(column: string | null): string | null {
    const match = column && this.dataSource?.entityMetadatas
      .flatMap((m) => m.columns)
      .find((c) => c.databaseName === column);
    return (match && match.propertyPath) || column;
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

    if (isInvalidValue(exception)) {
      const { value, column } = getInvalidValueDetails(exception);
      const field = this.resolveFieldName(column);
      this.logger.warn(`Invalid value rejected with 400: ${(exception as any).driverError.sqlMessage} | query: ${exception.query}`);
      const body = {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `ערך לא תקין${value !== null ? ` "${value}"` : ''}${field ? ` בשדה ${getTranslatedProperty(field)}` : ''}`,
        field,
      };
      this.httpAdapter.reply(response, body, HttpStatus.BAD_REQUEST);
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
