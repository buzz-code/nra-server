import { CleanupOldJobsHandler } from '../handlers/cleanup-old-jobs.handler';
import { Job } from '@shared/entities/Job.entity';

describe('CleanupOldJobsHandler', () => {
  it('deletes terminal jobs older than the cutoff and reports the count', async () => {
    const repo = { delete: jest.fn().mockResolvedValue({ affected: 4 }) } as any;
    const handler = new CleanupOldJobsHandler(repo);
    const result = await handler.handle({ payload: { days: 15 } } as unknown as Job);
    expect(repo.delete).toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.anything(), updatedAt: expect.anything() }),
    );
    expect(result.deleted).toBe(4);
    expect(result.summary).toContain('4');
  });

  it('defaults to 30 days when payload omits days', async () => {
    const repo = { delete: jest.fn().mockResolvedValue({ affected: 0 }) } as any;
    const handler = new CleanupOldJobsHandler(repo);
    const result = await handler.handle({ payload: null } as Job);
    expect(result.summary).toContain('30 days');
  });
});
