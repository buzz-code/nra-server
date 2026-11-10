import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { hostname } from 'os';
import { Job } from '@shared/entities/Job.entity';
import { MailSendService } from '@shared/utils/mail/mail-send.service';
import { JobService } from './job.service';
import { ScheduleSyncService } from './schedule-sync.service';
import { JOB_HANDLER, JobHandler, JobResult } from './job.types';

const MAX_IDLE_MS = Number(process.env.JOB_POLL_MS) || 5 * 60_000;
const ERROR_RETRY_MS = 30_000;
const BATCH = Number(process.env.JOB_WORKER_BATCH) || 5;
// A running job's lock is renewed this often while its handler runs; one not
// renewed for LOCK_TTL_MS belongs to a dead worker and is released to pending.
const LOCK_TTL_MS = Number(process.env.JOB_LOCK_TTL_MS) || 10 * 60_000;
const HEARTBEAT_MS = Math.max(Math.floor(LOCK_TTL_MS / 4), 1000);
// On shutdown, how long to wait for the job in progress. Fits the containers'
// stop_grace_period (40s) after gracefulShutdown's 5s proxy wait.
const SHUTDOWN_WAIT_MS = Number(process.env.JOB_SHUTDOWN_WAIT_MS) || 25_000;

/**
 * Runs due jobs from the jobs table. Instead of polling on a fixed interval it
 * sleeps until the next pending job's availableAt (capped at JOB_POLL_MS as a
 * safety net, which also re-runs schedule reconcile), and is woken immediately
 * when a job is enqueued in-process. Enqueues from another process (separate
 * API and worker) are only seen on the next wake, so run a single worker in
 * the API process, or lower JOB_POLL_MS when they are split.
 * Disabled by default; set WORKER_ENABLED=true on the instance(s) that should
 * process jobs (typically a dedicated worker process, or the single API
 * container for small deployments).
 *
 * Restarts: on shutdown the worker claims nothing more, aborts the running
 * handler's signal (JobContext) and waits up to JOB_SHUTDOWN_WAIT_MS; a job
 * that stops on the signal goes back to pending for the next instance. A
 * worker killed outright stops renewing its locks, and its running jobs are
 * released after JOB_LOCK_TTL_MS.
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
  private lastReconcileAt = 0;
  private readonly shutdown = new AbortController();
  private polling: Promise<void> | null = null;

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
    this.wake();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.shutdown.abort();
    if (!this.polling) {
      return;
    }
    let timeout: NodeJS.Timeout;
    await Promise.race([this.polling, new Promise((resolve) => (timeout = setTimeout(resolve, SHUTDOWN_WAIT_MS)))]);
    clearTimeout(timeout);
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

  poll(): Promise<void> {
    if (!JobWorkerService.isEnabled() || this.busy || this.stopped) {
      return Promise.resolve();
    }
    this.polling = this.runPoll().finally(() => (this.polling = null));
    return this.polling;
  }

  private async runPoll(): Promise<void> {
    this.busy = true;
    let delay = MAX_IDLE_MS;
    try {
      if (Date.now() - this.lastReconcileAt >= MAX_IDLE_MS) {
        this.lastReconcileAt = Date.now();
        await this.scheduleSync.reconcile().catch((err) => this.logger.error(`schedule reconcile failed: ${err?.message}`));
      }
      const released = await this.jobService.releaseStale(LOCK_TTL_MS);
      if (released) {
        this.logger.warn(`released ${released} stale running job(s) of a stopped worker`);
      }
      let claimed: number;
      do {
        this.rerun = false;
        claimed = await this.processBatch();
      } while (!this.stopped && (claimed === BATCH || this.rerun));
      const next = await this.jobService.nextAvailableAt();
      if (next) {
        delay = Math.min(Math.max(next.getTime() - Date.now(), 0), MAX_IDLE_MS);
      }
    } catch (err) {
      this.logger.error(`worker poll failed: ${err?.message}`);
      delay = ERROR_RETRY_MS;
    } finally {
      this.busy = false;
      if (this.rerun) {
        // Woken while querying nextAvailableAt: the new job may be earlier.
        delay = 0;
      }
      if (!this.stopped) {
        this.timer = setTimeout(() => this.poll(), delay);
      }
    }
  }

  async processBatch(): Promise<number> {
    const jobs = await this.jobService.claimNext(this.workerId, BATCH);
    for (const job of jobs) {
      if (this.stopped) {
        // Claimed but not started: hand it straight back.
        await this.jobService.release(job);
        continue;
      }
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
    const heartbeat = setInterval(() => {
      this.jobService.heartbeat(job).catch((err) => this.logger.error(`job ${job.id} heartbeat failed: ${err?.message}`));
    }, HEARTBEAT_MS);
    try {
      const result = (await handler.handle(job, { signal: this.shutdown.signal })) || null;
      await this.jobService.markCompleted(job, result);
      await this.notify(job, result);
    } catch (err) {
      if (this.shutdown.signal.aborted) {
        // Stopped for the shutdown, not failed: the next instance resumes it.
        this.logger.log(`job ${job.id} (${job.type}) interrupted by shutdown, back to pending`);
        await this.jobService.release(job);
        return;
      }
      this.logger.error(`job ${job.id} (${job.type}) failed: ${err?.message}`);
      await this.jobService.markFailed(job, err?.message ?? 'unknown error');
      if (job.status === 'failed') {
        await this.notify(job, null);
      }
    } finally {
      clearInterval(heartbeat);
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
