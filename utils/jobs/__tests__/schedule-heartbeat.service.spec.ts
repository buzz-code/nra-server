import { ScheduleHeartbeatService } from '../schedule-heartbeat.service';
import { Schedule } from '@shared/entities/Schedule.entity';

describe('ScheduleHeartbeatService', () => {
  const OLD_ENV = process.env.WORKER_ENABLED;
  afterEach(() => {
    process.env.WORKER_ENABLED = OLD_ENV;
  });

  function makeRepo(schedules: Partial<Schedule>[]) {
    return {
      find: jest.fn().mockResolvedValue(schedules),
      save: jest.fn((x) => Promise.resolve(x)),
    } as any;
  }

  it('does nothing when worker disabled', async () => {
    process.env.WORKER_ENABLED = 'false';
    const repo = makeRepo([]);
    const jobService = { enqueue: jest.fn() } as any;
    const service = new ScheduleHeartbeatService(repo, jobService);
    await service.tick();
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('initializes nextRunAt without enqueueing when null', async () => {
    process.env.WORKER_ENABLED = 'true';
    const schedule: Partial<Schedule> = { id: 1, cronExpression: '0 18 * * 5', timeZone: 'Asia/Jerusalem', nextRunAt: null };
    const repo = makeRepo([schedule]);
    const jobService = { enqueue: jest.fn() } as any;
    const service = new ScheduleHeartbeatService(repo, jobService);
    await service.tick();
    expect(jobService.enqueue).not.toHaveBeenCalled();
    expect(schedule.nextRunAt).toBeInstanceOf(Date);
    expect(repo.save).toHaveBeenCalled();
  });

  it('enqueues due schedules and advances nextRunAt', async () => {
    process.env.WORKER_ENABLED = 'true';
    const past = new Date(Date.now() - 60_000);
    const schedule: Partial<Schedule> = {
      id: 2,
      userId: 9,
      jobType: 'cleanup-old-jobs',
      payload: { days: 30 },
      cronExpression: '*/5 * * * *',
      timeZone: 'Asia/Jerusalem',
      nextRunAt: past,
    };
    const repo = makeRepo([schedule]);
    const jobService = { enqueue: jest.fn().mockResolvedValue({ id: 100 }) } as any;
    const service = new ScheduleHeartbeatService(repo, jobService);
    await service.tick();
    expect(jobService.enqueue).toHaveBeenCalledWith(
      9,
      'cleanup-old-jobs',
      { days: 30 },
      expect.objectContaining({ dedupeKey: expect.stringContaining('sched-2-') }),
    );
    expect(schedule.nextRunAt.getTime()).toBeGreaterThan(past.getTime());
    expect(schedule.lastRunAt).toBeInstanceOf(Date);
  });

  it('computeNext returns a future date from the cron expression', () => {
    const repo = makeRepo([]);
    const service = new ScheduleHeartbeatService(repo, { enqueue: jest.fn() } as any);
    const next = service.computeNext({ cronExpression: '*/5 * * * *', timeZone: 'Asia/Jerusalem' } as Schedule);
    expect(next.getTime()).toBeGreaterThan(Date.now());
  });
});
