import { Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as JSZip from 'jszip';
import { Job } from '@shared/entities/Job.entity';
import { DataToExcelReportGenerator } from '@shared/utils/report/data-to-excel.generator';
import { S3FileStoreService } from '@shared/utils/s3/s3-file-store.service';
import { JobHandler, JobResult } from '../job.types';

/**
 * Full data takeout: one Excel sheet per user-owned entity, zipped. Large files
 * go to S3 (when S3_BUCKET is set) and are delivered by link; otherwise the zip
 * is returned base64 for direct download via the async-download button.
 * Covers the "move to another platform" example.
 */
@Injectable()
export class UserDataExportHandler implements JobHandler {
  readonly type = 'user-data-export';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() private readonly fileStore?: S3FileStoreService,
  ) {}

  async handle(job: Job): Promise<JobResult> {
    const zip = new JSZip();
    let sheets = 0;

    for (const meta of this.dataSource.entityMetadatas) {
      const hasUserId = meta.columns.some((c) => c.propertyName === 'userId');
      if (!hasUserId) {
        continue;
      }
      const rows = await this.dataSource.getRepository(meta.target).find({ where: { userId: job.userId } as any });
      if (!rows.length) {
        continue;
      }
      const headerRow = meta.columns.map((c) => c.propertyName);
      const formattedData = rows.map((row) => headerRow.map((prop) => formatCell(row[prop])));
      const generator = new DataToExcelReportGenerator(() => meta.tableName);
      const buffer = await generator.getFileBuffer({ headerRow, formattedData, sheetName: meta.tableName });
      zip.file(`${meta.tableName}.xlsx`, buffer);
      sheets++;
    }

    const zipBuffer: Buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const filename = `data-export-${job.userId}.zip`;

    if (this.fileStore && process.env.S3_BUCKET) {
      const key = this.fileStore.buildKey('data-export', job.userId, 'zip');
      await this.fileStore.upload(key, zipBuffer, 'application/zip');
      return { summary: `exported ${sheets} tables`, s3Key: key, filename, format: 'zip' };
    }

    return { summary: `exported ${sheets} tables`, data: zipBuffer.toString('base64'), filename, format: 'zip' };
  }
}

function formatCell(value: any): string | number {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value as string | number;
}
