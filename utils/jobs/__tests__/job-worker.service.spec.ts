import { JobWorkerService } from '../job-worker.service';
import { Job } from '@shared/entities/Job.entity';
import { JobHandler } from '../job.types';

describe('JobWorkerService', () => {
  const OLD_ENV = process.env.WORKER_ENABLED;
  let worker: JobWorkerService;
  afterEach(() => {
    process.env.WORKER_ENABLED = OLD_ENV;
    worker?.onModuleDestroy();
  });

  function makeJobService() {
    return {
      claimNext: jest.fn().mockResolvedValue([]),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
      nextAvailableAt: jest.fn().mockResolvedValue(null),
      onEnqueue: jest.fn(),
    } as any;
  }

  function makeScheduleSync() {
    return {
      onRun: jest.fn().mockResolvedValue(undefined),
      reconcile: jest.fn().mockResolvedValue(undefined),
    } as any;
  }

  it('runs a handler and marks the job completed', async () => {
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockResolvedValue({ summary: 'ok' }) };
    const jobService = makeJobService();
    worker = new JobWorkerService([handler], jobService, makeScheduleSync());
    const job = { id: 1, type: 'demo', payload: {} } as Job;
    await worker.runJob(job);
    expect(handler.handle).toHaveBeenCalledWith(job);
    expect(jobService.markCompleted).toHaveBeenCalledWith(job, { summary: 'ok' });
  });

  it('fails the job when no handler is registered', async () => {
    const jobService = makeJobService();
    worker = new JobWorkerService([], jobService, makeScheduleSync());
    const job = { id: 2, type: 'missing', payload: {} } as Job;
    await worker.runJob(job);
    expect(jobService.markFailed).toHaveBeenCalledWith(job, expect.stringContaining('missing'));
  });

  it('marks the job failed when the handler throws', async () => {
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockRejectedValue(new Error('boom')) };
    const jobService = makeJobService();
    worker = new JobWorkerService([handler], jobService, makeScheduleSync());
    const job = { id: 3, type: 'demo', payload: {}, status: 'running' } as Job;
    await worker.runJob(job);
    expect(jobService.markFailed).toHaveBeenCalledWith(job, 'boom');
  });

  it('sends a completion email when notifyEmail is set', async () => {
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockResolvedValue({ url: 'http://x/f.zip' }) };
    const jobService = makeJobService();
    const mail = { sendMail: jest.fn().mockResolvedValue(undefined) } as any;
    worker = new JobWorkerService([handler], jobService, makeScheduleSync(), mail);
    const job = { id: 4, type: 'demo', payload: { notifyEmail: 'a@b.com' }, status: 'completed' } as unknown as Job;
    await worker.runJob(job);
    expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.com' }));
  });

  it('poll does nothing when worker disabled', async () => {
    process.env.WORKER_ENABLED = 'false';
    const jobService = makeJobService();
    worker = new JobWorkerService([], jobService, makeScheduleSync());
    await worker.poll();
    expect(jobService.claimNext).not.toHaveBeenCalled();
  });

  it('poll processes claimed jobs when enabled', async () => {
    process.env.WORKER_ENABLED = 'true';
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockResolvedValue(null) };
    const job = { id: 5, type: 'demo', payload: {} } as Job;
    const jobService = makeJobService();
    jobService.claimNext.mockResolvedValue([job]);
    worker = new JobWorkerService([handler], jobService, makeScheduleSync());
    await worker.poll();
    expect(jobService.claimNext).toHaveBeenCalled();
    expect(jobService.markCompleted).toHaveBeenCalledWith(job, null);
  });

  it('chains the next schedule run before the handler on the first attempt', async () => {
    const order: string[] = [];
    const handler: JobHandler = { type: 'demo', handle: jest.fn(async () => { order.push('handle'); }) };
    const scheduleSync = makeScheduleSync();
    scheduleSync.onRun.mockImplementation(async () => { order.push('chain'); });
    worker = new JobWorkerService([handler], makeJobService(), scheduleSync);
    await worker.runJob({ id: 6, type: 'demo', payload: {}, attempts: 1, dedupeKey: 'sched-4-2026-10-20T10:00:00.000Z' } as Job);
    expect(scheduleSync.onRun).toHaveBeenCalledWith(4);
    expect(order).toEqual(['chain', 'handle']);
  });

  it('does not chain again on retries or for non-schedule jobs', async () => {
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockResolvedValue(null) };
    const scheduleSync = makeScheduleSync();
    worker = new JobWorkerService([handler], makeJobService(), scheduleSync);
    await worker.runJob({ id: 7, type: 'demo', payload: {}, attempts: 2, dedupeKey: 'sched-4-x' } as Job);
    await worker.runJob({ id: 8, type: 'demo', payload: {}, attempts: 1, dedupeKey: null } as Job);
    expect(scheduleSync.onRun).not.toHaveBeenCalled();
  });

  it('still runs the job when chaining fails', async () => {
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockResolvedValue(null) };
    const scheduleSync = makeScheduleSync();
    scheduleSync.onRun.mockRejectedValue(new Error('db down'));
    const jobService = makeJobService();
    worker = new JobWorkerService([handler], jobService, scheduleSync);
    const job = { id: 9, type: 'demo', payload: {}, attempts: 1, dedupeKey: 'sched-4-x' } as Job;
    await worker.runJob(job);
    expect(jobService.markCompleted).toHaveBeenCalledWith(job, null);
  });

  describe('timer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      process.env.WORKER_ENABLED = 'true';
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('sleeps until the next pending job is due', async () => {
      const jobService = makeJobService();
      jobService.nextAvailableAt.mockResolvedValue(new Date(Date.now() + 10_000));
      worker = new JobWorkerService([], jobService, makeScheduleSync());
      await worker.poll();
      expect(jobService.claimNext).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(9_000);
      expect(jobService.claimNext).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1_000);
      expect(jobService.claimNext).toHaveBeenCalledTimes(2);
    });

    it('caps the sleep at the safety-net interval when nothing is pending', async () => {
      const jobService = makeJobService();
      worker = new JobWorkerService([], jobService, makeScheduleSync());
      await worker.poll();
      await jest.advanceTimersByTimeAsync(5 * 60_000 - 1);
      expect(jobService.claimNext).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(jobService.claimNext).toHaveBeenCalledTimes(2);
    });

    it('bootstrap reconciles schedules, subscribes to enqueue and wakes on it', async () => {
      const jobService = makeJobService();
      const scheduleSync = makeScheduleSync();
      worker = new JobWorkerService([], jobService, scheduleSync);
      await worker.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(0);
      expect(scheduleSync.reconcile).toHaveBeenCalled();
      expect(jobService.claimNext).toHaveBeenCalledTimes(1);
      const listener = jobService.onEnqueue.mock.calls[0][0];
      listener();
      await jest.advanceTimersByTimeAsync(0);
      expect(jobService.claimNext).toHaveBeenCalledTimes(2);
    });

    it('re-runs right after the current batch when woken while busy', async () => {
      const jobService = makeJobService();
      let release: () => void;
      jobService.claimNext.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve([]); }));
      worker = new JobWorkerService([], jobService, makeScheduleSync());
      const running = worker.poll();
      worker.wake();
      release();
      await running;
      expect(jobService.claimNext).toHaveBeenCalledTimes(2);
    });

    it('bootstrap does nothing when worker disabled', async () => {
      process.env.WORKER_ENABLED = 'false';
      const jobService = makeJobService();
      const scheduleSync = makeScheduleSync();
      worker = new JobWorkerService([], jobService, scheduleSync);
      await worker.onApplicationBootstrap();
      expect(jobService.onEnqueue).not.toHaveBeenCalled();
      expect(scheduleSync.reconcile).not.toHaveBeenCalled();
    });
  });
});
