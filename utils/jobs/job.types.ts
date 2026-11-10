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

/** Passed to a handler alongside its job. */
export interface JobContext {
  /**
   * Aborted when the process shuts down (a deploy). A long handler checks it
   * between safe steps, saves its progress (e.g. into job.payload) and throws:
   * the job then goes back to pending, without using up an attempt, and the
   * next instance resumes it. A handler that ignores it simply runs on until
   * the shutdown wait (JOB_SHUTDOWN_WAIT_MS) ends.
   */
  signal: AbortSignal;
}

/**
 * A unit of background work. Handlers are Nest providers registered via
 * JobsModule; they receive their own dependencies through DI.
 */
export interface JobHandler {
  /** Unique key matched against Job.type. */
  readonly type: string;
  handle(job: Job, context?: JobContext): Promise<JobResult | void>;
}
