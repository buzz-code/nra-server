import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Job } from '@shared/entities/Job.entity';
import { JobHandler, JobResult } from '../job.types';

/**
 * Retention: delete terminal jobs older than `payload.days` (default 30).
 * Pair with a Schedule row to keep the jobs table from growing forever.
 */
@Injectable()
export class CleanupOldJobsHandler implements JobHandler {
  readonly type = 'cleanup-old-jobs';

  constructor(@InjectRepository(Job) private readonly repo: Repository<Job>) {}

  async handle(job: Job): Promise<JobResult> {
    const days = Number(job.payload?.days) || 30;
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const res = await this.repo.delete({
      status: In(['completed', 'failed', 'cancelled']),
      updatedAt: LessThan(cutoff),
    });
    return { summary: `deleted ${res.affected ?? 0} jobs older than ${days} days`, deleted: res.affected ?? 0 };
  }
}
