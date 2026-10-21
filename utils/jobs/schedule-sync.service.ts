import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import * as parser from 'cron-parser';
import { Schedule } from '@shared/entities/Schedule.entity';
import { JobService } from './job.service';

const KEY_PREFIX = 'sched-';

/**
 * Turns recurring Schedule rows into Jobs without a heartbeat: each schedule
 * always has exactly one pending job at its next run time, and running that
 * job enqueues the following one. Schedule CRUD calls `sync()` so edits take
 * effect at once; `reconcile()` on worker boot repairs any broken chain.
 */
@Injectable()
export class ScheduleSyncService {
  private readonly logger = new Logger(ScheduleSyncService.name);

  constructor(
    @InjectRepository(Schedule) private readonly repo: Repository<Schedule>,
    private readonly jobService: JobService,
  ) {}

  /** Schedule id of a job enqueued by this service, or null for any other job. */
  static scheduleIdOf(dedupeKey: string | null): number | null {
    const match = dedupeKey?.match(/^sched-(\d+)-/);
    return match ? Number(match[1]) : null;
  }

  /** Replace the schedule's pending job after create/update/delete. */
  async sync(scheduleId: number): Promise<void> {
    await this.jobService.cancelPending(`${KEY_PREFIX}${scheduleId}-`);
    const schedule = await this.repo.findOne({ where: { id: scheduleId } });
    if (!schedule) {
      return;
    }
    if (!schedule.active) {
      await this.repo.update(schedule.id, { nextRunAt: null });
      return;
    }
    await this.enqueueNext(schedule);
  }

  /** Called by the worker when a scheduled job starts: chain the next run. */
  async onRun(scheduleId: number): Promise<void> {
    const schedule = await this.repo.findOne({ where: { id: scheduleId } });
    if (!schedule?.active) {
      return;
    }
    await this.enqueueNext(schedule, new Date());
  }

  /**
   * Enqueue the next run for every active schedule that has no pending
   * not-yet-attempted job (a retry of a past run doesn't count). Runs on
   * worker boot and periodically, so a failed chaining step self-heals.
   */
  async reconcile(): Promise<void> {
    const schedules = await this.repo.find({ where: { active: true } });
    for (const schedule of schedules) {
      try {
        const pending = await this.jobService.repo.count({
          where: { status: 'pending', attempts: 0, dedupeKey: Like(`${KEY_PREFIX}${schedule.id}-%`) },
        });
        if (!pending) {
          await this.enqueueNext(schedule);
        }
      } catch (err) {
        this.logger.error(`schedule ${schedule.id} reconcile failed: ${err?.message}`);
      }
    }
  }

  computeNext(schedule: Pick<Schedule, 'cronExpression' | 'timeZone'>): Date {
    return parser
      .parseExpression(schedule.cronExpression, { tz: schedule.timeZone || 'Asia/Jerusalem', currentDate: new Date() })
      .next()
      .toDate();
  }

  /**
   * True for a standard 5-field cron expression whose time zone can produce a
   * next run. cron-parser alone accepts fewer fields (and '' as every minute).
   */
  isValid(schedule: Pick<Schedule, 'cronExpression' | 'timeZone'>): boolean {
    if (typeof schedule.cronExpression !== 'string' || schedule.cronExpression.trim().split(/\s+/).length !== 5) {
      return false;
    }
    try {
      this.computeNext(schedule);
      return true;
    } catch {
      return false;
    }
  }

  private async enqueueNext(schedule: Schedule, lastRunAt?: Date): Promise<void> {
    const nextRunAt = this.computeNext(schedule);
    await this.jobService.enqueue(schedule.userId, schedule.jobType, schedule.payload, {
      availableAt: nextRunAt,
      dedupeKey: `${KEY_PREFIX}${schedule.id}-${nextRunAt.toISOString()}`,
    });
    await this.repo.update(schedule.id, lastRunAt ? { nextRunAt, lastRunAt } : { nextRunAt });
  }
}
