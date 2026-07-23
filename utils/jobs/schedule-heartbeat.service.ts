import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import * as parser from 'cron-parser';
import { Schedule } from '@shared/entities/Schedule.entity';
import { JobService } from './job.service';
import { JobWorkerService } from './job-worker.service';

/**
 * Single per-minute heartbeat that turns recurring Schedule rows into Jobs.
 * All scheduling lives in data (the schedules table), so times can change
 * without a redeploy. Runs only on the worker instance to avoid double-firing
 * when the API is scaled to multiple replicas.
 */
@Injectable()
export class ScheduleHeartbeatService {
  private readonly logger = new Logger(ScheduleHeartbeatService.name);

  constructor(
    @InjectRepository(Schedule) private readonly repo: Repository<Schedule>,
    private readonly jobService: JobService,
  ) {}

  @Cron('* * * * *')
  async tick(): Promise<void> {
    if (!JobWorkerService.isEnabled()) {
      return;
    }
    const now = new Date();
    const schedules = await this.repo.find({ where: { active: true } });
    for (const schedule of schedules) {
      try {
        if (!schedule.nextRunAt) {
          schedule.nextRunAt = this.computeNext(schedule);
          await this.repo.save(schedule);
          continue;
        }
        if (schedule.nextRunAt <= now) {
          const dedupeKey = `sched-${schedule.id}-${schedule.nextRunAt.toISOString()}`;
          await this.jobService.enqueue(schedule.userId, schedule.jobType, schedule.payload, { dedupeKey });
          schedule.lastRunAt = now;
          schedule.nextRunAt = this.computeNext(schedule);
          await this.repo.save(schedule);
        }
      } catch (err) {
        this.logger.error(`schedule ${schedule.id} failed: ${err?.message}`);
      }
    }
  }

  computeNext(schedule: Schedule): Date {
    return parser
      .parseExpression(schedule.cronExpression, { tz: schedule.timeZone || 'Asia/Jerusalem', currentDate: new Date() })
      .next()
      .toDate();
  }
}
