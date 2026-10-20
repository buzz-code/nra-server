import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { hostname } from 'os';
import { Job } from '@shared/entities/Job.entity';
import { MailSendService } from '@shared/utils/mail/mail-send.service';
import { JobService } from './job.service';
import { ScheduleSyncService } from './schedule-sync.service';
import { JOB_HANDLER, JobHandler, JobResult } from './job.types';

const MAX_IDLE_MS = Number(process.env.JOB_POLL_MS) || 5 * 60_000;
const BATCH = Number(process.env.JOB_WORKER_BATCH) || 5;

/**
 * Runs due jobs from the jobs table. Instead of polling on a fixed interval it
 * sleeps until the next pending job's availableAt (capped at JOB_POLL_MS as a
 * safety net), and is woken immediately when a job is enqueued in-process.
 * Disabled by default; set WORKER_ENABLED=true on the instance(s) that should
 * process jobs (typically a dedicated worker process, or the single API
 * container for small deployments).
 */
@Injectable()
export class JobWorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobWorkerService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly workerId = `${hostname()}:${process.pid}`;
  private busy = false;
  private rerun = false;
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(JOB_HANDLER) handlers: JobHandler[],
    private readonly jobService: JobService,
    private readonly scheduleSync: ScheduleSyncService,
    @Optional() private readonly mailSendService?: MailSendService,
  ) {
    for (const handler of handlers ?? []) {
      this.handlers.set(handler.type, handler);
    }
  }

  static isEnabled(): boolean {
    return process.env.WORKER_ENABLED === 'true';
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!JobWorkerService.isEnabled()) {
      return;
    }
    this.jobService.onEnqueue(() => this.wake());
    try {
      await this.scheduleSync.reconcile();
    } catch (err) {
      this.logger.error(`schedule reconcile failed: ${err?.message}`);
    }
    this.wake();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  /** Run due jobs now (or right after the current batch) and re-arm the timer. */
  wake(): void {
    if (this.stopped) {
      return;
    }
    if (this.busy) {
      this.rerun = true;
      return;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.poll();
  }

  async poll(): Promise<void> {
    if (!JobWorkerService.isEnabled() || this.busy) {
      return;
    }
    this.busy = true;
    let delay = MAX_IDLE_MS;
    try {
      let claimed: number;
      do {
        this.rerun = false;
        claimed = await this.processBatch();
      } while (claimed === BATCH || this.rerun);
      const next = await this.jobService.nextAvailableAt();
      if (next) {
        delay = Math.min(Math.max(next.getTime() - Date.now(), 0), MAX_IDLE_MS);
      }
    } catch (err) {
      this.logger.error(`worker poll failed: ${err?.message}`);
    } finally {
      this.busy = false;
      if (!this.stopped) {
        this.timer = setTimeout(() => this.poll(), delay);
      }
    }
  }

  async processBatch(): Promise<number> {
    const jobs = await this.jobService.claimNext(this.workerId, BATCH);
    for (const job of jobs) {
      await this.runJob(job);
    }
    return jobs.length;
  }

  async runJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.jobService.markFailed(job, `no handler registered for type "${job.type}"`);
      return;
    }
    // Chain the next run before the handler, so a crash or final failure
    // can't break the schedule. Only on the first attempt: retries reuse it.
    const scheduleId = ScheduleSyncService.scheduleIdOf(job.dedupeKey);
    if (scheduleId && job.attempts === 1) {
      try {
        await this.scheduleSync.onRun(scheduleId);
      } catch (err) {
        this.logger.error(`schedule ${scheduleId} chaining failed: ${err?.message}`);
      }
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
