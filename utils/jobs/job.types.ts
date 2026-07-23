import { Job } from '@shared/entities/Job.entity';

/** DI token collecting all registered job handlers (multi-provider). */
export const JOB_HANDLER = Symbol('JOB_HANDLER');

export interface JobResult {
  /** Base64 file for direct client download (small files). */
  data?: string;
  /** S3 key / URL for large files delivered out-of-band. */
  url?: string;
  s3Key?: string;
  filename?: string;
  format?: string;
  summary?: string;
  [key: string]: any;
}

/**
 * A unit of background work. Handlers are Nest providers registered via
 * JobsModule; they receive their own dependencies through DI.
 */
export interface JobHandler {
  /** Unique key matched against Job.type. */
  readonly type: string;
  handle(job: Job): Promise<JobResult | void>;
}
