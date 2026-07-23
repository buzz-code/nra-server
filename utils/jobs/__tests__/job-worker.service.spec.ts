import { JobWorkerService } from '../job-worker.service';
import { Job } from '@shared/entities/Job.entity';
import { JobHandler } from '../job.types';

describe('JobWorkerService', () => {
  const OLD_ENV = process.env.WORKER_ENABLED;
  afterEach(() => {
    process.env.WORKER_ENABLED = OLD_ENV;
  });

  function makeJobService() {
    return {
      claimNext: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    } as any;
  }

  it('runs a handler and marks the job completed', async () => {
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockResolvedValue({ summary: 'ok' }) };
    const jobService = makeJobService();
    const worker = new JobWorkerService([handler], jobService);
    const job = { id: 1, type: 'demo', payload: {} } as Job;
    await worker.runJob(job);
    expect(handler.handle).toHaveBeenCalledWith(job);
    expect(jobService.markCompleted).toHaveBeenCalledWith(job, { summary: 'ok' });
  });

  it('fails the job when no handler is registered', async () => {
    const jobService = makeJobService();
    const worker = new JobWorkerService([], jobService);
    const job = { id: 2, type: 'missing', payload: {} } as Job;
    await worker.runJob(job);
    expect(jobService.markFailed).toHaveBeenCalledWith(job, expect.stringContaining('missing'));
  });

  it('marks the job failed when the handler throws', async () => {
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockRejectedValue(new Error('boom')) };
    const jobService = makeJobService();
    const worker = new JobWorkerService([handler], jobService);
    const job = { id: 3, type: 'demo', payload: {}, status: 'running' } as Job;
    await worker.runJob(job);
    expect(jobService.markFailed).toHaveBeenCalledWith(job, 'boom');
  });

  it('sends a completion email when notifyEmail is set', async () => {
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockResolvedValue({ url: 'http://x/f.zip' }) };
    const jobService = makeJobService();
    const mail = { sendMail: jest.fn().mockResolvedValue(undefined) } as any;
    const worker = new JobWorkerService([handler], jobService, mail);
    const job = { id: 4, type: 'demo', payload: { notifyEmail: 'a@b.com' }, status: 'completed' } as unknown as Job;
    await worker.runJob(job);
    expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@b.com' }));
  });

  it('poll does nothing when worker disabled', async () => {
    process.env.WORKER_ENABLED = 'false';
    const jobService = makeJobService();
    const worker = new JobWorkerService([], jobService);
    await worker.poll();
    expect(jobService.claimNext).not.toHaveBeenCalled();
  });

  it('poll processes claimed jobs when enabled', async () => {
    process.env.WORKER_ENABLED = 'true';
    const handler: JobHandler = { type: 'demo', handle: jest.fn().mockResolvedValue(null) };
    const job = { id: 5, type: 'demo', payload: {} } as Job;
    const jobService = makeJobService();
    jobService.claimNext.mockResolvedValue([job]);
    const worker = new JobWorkerService([handler], jobService);
    await worker.poll();
    expect(jobService.claimNext).toHaveBeenCalled();
    expect(jobService.markCompleted).toHaveBeenCalledWith(job, null);
  });
});
