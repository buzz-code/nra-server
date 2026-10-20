import { ScheduleSyncService } from '../schedule-sync.service';
import { Schedule } from '@shared/entities/Schedule.entity';

describe('ScheduleSyncService', () => {
  const schedule: Partial<Schedule> = {
    id: 2,
    userId: 9,
    jobType: 'cleanup-old-jobs',
    payload: { days: 30 },
    cronExpression: '*/5 * * * *',
    timeZone: 'Asia/Jerusalem',
    active: true,
  };

  function makeRepo(rows: Partial<Schedule>[]) {
    return {
      find: jest.fn().mockResolvedValue(rows),
      findOne: jest.fn(({ where }) => Promise.resolve(rows.find((row) => row.id === where.id) ?? null)),
      update: jest.fn().mockResolvedValue(undefined),
    } as any;
  }

  function makeJobService(pendingCount = 0) {
    return {
      enqueue: jest.fn().mockResolvedValue({ id: 100 }),
      cancelPending: jest.fn().mockResolvedValue(undefined),
      repo: { count: jest.fn().mockResolvedValue(pendingCount) },
    } as any;
  }

  it('scheduleIdOf parses only schedule dedupe keys', () => {
    expect(ScheduleSyncService.scheduleIdOf('sched-12-2026-10-20T10:00:00.000Z')).toBe(12);
    expect(ScheduleSyncService.scheduleIdOf('export-5')).toBeNull();
    expect(ScheduleSyncService.scheduleIdOf(null)).toBeNull();
  });

  it('sync cancels the old pending job and enqueues the next run at its cron time', async () => {
    const repo = makeRepo([schedule]);
    const jobService = makeJobService();
    const service = new ScheduleSyncService(repo, jobService);
    await service.sync(2);
    expect(jobService.cancelPending).toHaveBeenCalledWith('sched-2-');
    const [userId, type, payload, opts] = jobService.enqueue.mock.calls[0];
    expect([userId, type, payload]).toEqual([9, 'cleanup-old-jobs', { days: 30 }]);
    expect(opts.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(opts.dedupeKey).toBe(`sched-2-${opts.availableAt.toISOString()}`);
    expect(repo.update).toHaveBeenCalledWith(2, { nextRunAt: opts.availableAt });
  });

  it('sync of an inactive schedule only cancels and clears nextRunAt', async () => {
    const repo = makeRepo([{ ...schedule, active: false }]);
    const jobService = makeJobService();
    const service = new ScheduleSyncService(repo, jobService);
    await service.sync(2);
    expect(jobService.cancelPending).toHaveBeenCalledWith('sched-2-');
    expect(jobService.enqueue).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(2, { nextRunAt: null });
  });

  it('sync of a deleted schedule only cancels', async () => {
    const repo = makeRepo([]);
    const jobService = makeJobService();
    const service = new ScheduleSyncService(repo, jobService);
    await service.sync(2);
    expect(jobService.cancelPending).toHaveBeenCalledWith('sched-2-');
    expect(jobService.enqueue).not.toHaveBeenCalled();
  });

  it('onRun chains the next run and records lastRunAt', async () => {
    const repo = makeRepo([schedule]);
    const jobService = makeJobService();
    const service = new ScheduleSyncService(repo, jobService);
    await service.onRun(2);
    expect(jobService.enqueue).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(2, { nextRunAt: expect.any(Date), lastRunAt: expect.any(Date) });
  });

  it('onRun does not chain an inactive schedule', async () => {
    const repo = makeRepo([{ ...schedule, active: false }]);
    const jobService = makeJobService();
    const service = new ScheduleSyncService(repo, jobService);
    await service.onRun(2);
    expect(jobService.enqueue).not.toHaveBeenCalled();
  });

  it('reconcile enqueues only for schedules without a pending job', async () => {
    const repo = makeRepo([schedule]);
    const withPending = makeJobService(1);
    await new ScheduleSyncService(repo, withPending).reconcile();
    expect(withPending.enqueue).not.toHaveBeenCalled();

    const withoutPending = makeJobService(0);
    await new ScheduleSyncService(repo, withoutPending).reconcile();
    expect(withoutPending.enqueue).toHaveBeenCalledTimes(1);
  });
});
