import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter } from '../all-exceptions.filter';

function buildFkViolation(referencingTable: string) {
  const sqlMessage = `Cannot delete or update a parent row: a foreign key constraint fails (\`app_db\`.\`${referencingTable}\`, CONSTRAINT \`FK_x\` FOREIGN KEY (\`teacherReferenceId\`) REFERENCES \`teachers\` (\`id\`))`;
  const error = new QueryFailedError('DELETE FROM `teachers` WHERE `id` = ?', [6848], new Error(sqlMessage));
  (error as any).driverError = { code: 'ER_ROW_IS_REFERENCED_2', errno: 1451, sqlMessage };
  return error;
}

function buildDataSource(entityMetadatas: { tableName: string; targetName: string }[]) {
  return { entityMetadatas } as any;
}

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

  it('turns a foreign key violation into a 409 naming the mapped resource', () => {
    const httpAdapter = { reply: jest.fn() };
    const dataSource = buildDataSource([{ tableName: 'report_groups', targetName: 'ReportGroup' }]);
    const filter = new AllExceptionsFilter(httpAdapter as any, dataSource);
    const exception = buildFkViolation('report_groups');
    const response: any = {};

    filter.catch(exception, buildHost(response));

    expect(response.err).toBeUndefined();
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 409,
        message: 'לא ניתן למחוק רשומה זו - קיימות רשומות מסוג "report group" המשויכות אליה. יש למחוק אותן תחילה.',
        resource: 'report_group',
      },
      409,
    );
  });

  it('falls back to the raw table name for a foreign key violation with no mapped resource', () => {
    const httpAdapter = { reply: jest.fn() };
    const filter = new AllExceptionsFilter(httpAdapter as any);
    const exception = buildFkViolation('some_table');
    const response: any = {};

    filter.catch(exception, buildHost(response));

    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 409,
        message: 'לא ניתן למחוק רשומה זו - קיימות רשומות מסוג "some table" המשויכות אליה. יש למחוק אותן תחילה.',
        resource: 'some_table',
      },
      409,
    );
  });
});
