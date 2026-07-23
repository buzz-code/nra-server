import { UserDataExportHandler } from '../handlers/user-data-export.handler';
import { Job } from '@shared/entities/Job.entity';

jest.mock('@shared/utils/report/data-to-excel.generator', () => ({
  DataToExcelReportGenerator: class {
    constructor(public getName: any) {}
    async getFileBuffer() {
      return Buffer.from('xlsx');
    }
  },
}));

describe('UserDataExportHandler', () => {
  function makeDataSource(metas: any[], rowsByTable: Record<string, any[]>) {
    return {
      entityMetadatas: metas,
      getRepository: (target: any) => ({
        find: jest.fn().mockResolvedValue(rowsByTable[target] ?? []),
      }),
    } as any;
  }

  it('zips a sheet per user-owned entity and returns base64 when no S3', async () => {
    const metas = [
      { target: 'Student', tableName: 'student', columns: [{ propertyName: 'userId' }, { propertyName: 'name' }] },
      { target: 'Global', tableName: 'global', columns: [{ propertyName: 'id' }] }, // no userId → skipped
    ];
    const dataSource = makeDataSource(metas, { Student: [{ userId: 5, name: 'A' }] });
    const handler = new UserDataExportHandler(dataSource);
    const result = await handler.handle({ userId: 5, payload: {} } as Job);
    expect(result.format).toBe('zip');
    expect(result.data).toBeDefined();
    expect(result.s3Key).toBeUndefined();
    expect(result.summary).toContain('1 tables');
  });

  it('uploads to S3 and returns key when bucket configured', async () => {
    const OLD = process.env.S3_BUCKET;
    process.env.S3_BUCKET = 'my-bucket';
    const metas = [{ target: 'Student', tableName: 'student', columns: [{ propertyName: 'userId' }] }];
    const dataSource = makeDataSource(metas, { Student: [{ userId: 5 }] });
    const fileStore = {
      buildKey: jest.fn().mockReturnValue('data-export/x.zip'),
      upload: jest.fn().mockResolvedValue(undefined),
    } as any;
    const handler = new UserDataExportHandler(dataSource, fileStore);
    const result = await handler.handle({ userId: 5, payload: {} } as Job);
    expect(fileStore.upload).toHaveBeenCalled();
    expect(result.s3Key).toBe('data-export/x.zip');
    expect(result.data).toBeUndefined();
    process.env.S3_BUCKET = OLD;
  });
});
