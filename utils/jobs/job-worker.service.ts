import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { hostname } from 'os';
import { Job } from '@shared/entities/Job.entity';
import { MailSendService } from '@shared/utils/mail/mail-send.service';
import { JobService } from './job.service';
import { JOB_HANDLER, JobHandler, JobResult } from './job.types';

const POLL_MS = Number(process.env.JOB_POLL_MS) || 5000;
const BATCH = Number(process.env.JOB_WORKER_BATCH) || 5;

/**
 * Polls the jobs table and runs due jobs. Disabled by default; set
 * WORKER_ENABLED=true on the instance(s) that should process jobs (typically a
 * dedicated worker process, or the single API container for small deployments).
 */
@Injectable()
export class JobWorkerService {
  private readonly logger = new Logger(JobWorkerService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly workerId = `${hostname()}:${process.pid}`;
  private busy = false;

  constructor(
    @Inject(JOB_HANDLER) handlers: JobHandler[],
    private readonly jobService: JobService,
    @Optional() private readonly mailSendService?: MailSendService,
  ) {
    for (const handler of handlers ?? []) {
      this.handlers.set(handler.type, handler);
    }
  }

  static isEnabled(): boolean {
    return process.env.WORKER_ENABLED === 'true';
  }

  @Interval('job-worker', POLL_MS)
  async poll(): Promise<void> {
    if (!JobWorkerService.isEnabled() || this.busy) {
      return;
    }
    this.busy = true;
    try {
      await this.processBatch();
    } catch (err) {
      this.logger.error(`worker poll failed: ${err?.message}`);
    } finally {
      this.busy = false;
    }
  }

  async processBatch(): Promise<void> {
    const jobs = await this.jobService.claimNext(this.workerId, BATCH);
    for (const job of jobs) {
      await this.runJob(job);
    }
  }

  async runJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.jobService.markFailed(job, `no handler registered for type "${job.type}"`);
      return;
    }
    try {
      const result = (await handler.handle(job)) || null;
      await this.jobService.markCompleted(job, result);
      await this.notify(job, result);
    } catch (err) {
      this.logger.error(`job ${job.id} (${job.type}) failed: ${err?.message}`);
      await this.jobService.markFailed(job, err?.message ?? 'unknown error');
      if (job.status === 'failed') {
        await this.notify(job, null);
      }
    }
  }

  private async notify(job: Job, result: JobResult | null): Promise<void> {
    const to = job.payload?.notifyEmail;
    if (!to || !this.mailSendService) {
      return;
    }
    try {
      if (job.status === 'completed') {
        const link = result?.url ? `<p><a href="${result.url}">${result.url}</a></p>` : '';
        await this.mailSendService.sendMail({
          to,
          subject: `המשימה "${job.type}" הושלמה`,
          html: `<div>המשימה הושלמה בהצלחה.</div>${result?.summary ? `<div>${result.summary}</div>` : ''}${link}`,
        });
      } else {
        await this.mailSendService.sendMail({
          to,
          subject: `המשימה "${job.type}" נכשלה`,
          html: `<div>המשימה נכשלה: ${job.error ?? ''}</div>`,
        });
      }
    } catch (err) {
      this.logger.error(`failed to send notification for job ${job.id}: ${err?.message}`);
    }
  }
}
