import { JobService } from '../job.service';
import { Job } from '@shared/entities/Job.entity';

function makeRepo(overrides: Partial<Record<keyof any, any>> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    save: jest.fn((x) => Promise.resolve(x)),
    create: jest.fn((x) => x),
    ...overrides,
  } as any;
}

describe('JobService', () => {
  describe('enqueue', () => {
    it('creates a pending job with defaults', async () => {
      const repo = makeRepo();
      const service = new JobService(repo);
      const job = await service.enqueue(7, 'cleanup-old-jobs', { days: 10 });
      expect(repo.save).toHaveBeenCalled();
      expect(job.userId).toBe(7);
      expect(job.type).toBe('cleanup-old-jobs');
      expect(job.status).toBe('pending');
      expect(job.maxAttempts).toBe(3);
      expect(job.payload).toEqual({ days: 10 });
      expect(job.availableAt).toBeInstanceOf(Date);
    });

    it('skips enqueue when a non-terminal job shares the dedupeKey', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 1, status: 'pending' }) });
      const service = new JobService(repo);
      const job = await service.enqueue(7, 'x', {}, { dedupeKey: 'k' });
      expect(job).toBeNull();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('enqueues when the dedupeKey job is terminal', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 1, status: 'completed' }) });
      const service = new JobService(repo);
      const job = await service.enqueue(7, 'x', {}, { dedupeKey: 'k' });
      expect(job).not.toBeNull();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('claimNext', () => {
    it('claims only rows whose conditional update wins', async () => {
      const candidates = [
        { id: 1, attempts: 0 },
        { id: 2, attempts: 1 },
      ] as Job[];
      const repo = makeRepo({
        find: jest.fn().mockResolvedValue(candidates),
        update: jest
          .fn()
          .mockResolvedValueOnce({ affected: 1 })
          .mockResolvedValueOnce({ affected: 0 }),
      });
      const service = new JobService(repo);
      const claimed = await service.claimNext('worker-1', 5);
      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe(1);
      expect(claimed[0].status).toBe('running');
      expect(claimed[0].lockedBy).toBe('worker-1');
      expect(claimed[0].attempts).toBe(1);
    });
  });

  describe('markCompleted', () => {
    it('sets completed state and result', async () => {
      const repo = makeRepo();
      const service = new JobService(repo);
      const job = { attempts: 1 } as Job;
      await service.markCompleted(job, { summary: 'ok' });
      expect(job.status).toBe('completed');
      expect(job.progress).toBe(100);
      expect(job.result).toEqual({ summary: 'ok' });
      expect(job.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('markFailed', () => {
    it('reschedules with backoff while attempts remain', async () => {
      const repo = makeRepo();
      const service = new JobService(repo);
      const job = { attempts: 1, maxAttempts: 3, status: 'running' } as Job;
      const before = Date.now();
      await service.markFailed(job, 'boom');
      expect(job.status).toBe('pending');
      expect(job.lockedBy).toBeNull();
      expect(job.availableAt.getTime()).toBeGreaterThan(before);
      expect(job.error).toBe('boom');
    });

    it('marks terminally failed at maxAttempts', async () => {
      const repo = makeRepo();
      const service = new JobService(repo);
      const job = { attempts: 3, maxAttempts: 3, status: 'running' } as Job;
      await service.markFailed(job, 'boom');
      expect(job.status).toBe('failed');
      expect(job.completedAt).toBeInstanceOf(Date);
    });
  });
});
