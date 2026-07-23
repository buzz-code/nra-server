import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Job, JobStatus } from '@shared/entities/Job.entity';
import { JobResult } from './job.types';

export interface EnqueueOptions {
  availableAt?: Date;
  maxAttempts?: number;
  /** Idempotency key: enqueue is skipped if a pending/running job already has it. */
  dedupeKey?: string;
}

const TERMINAL: JobStatus[] = ['completed', 'failed', 'cancelled'];

@Injectable()
export class JobService {
  constructor(@InjectRepository(Job) public readonly repo: Repository<Job>) {}

  async enqueue(userId: number, type: string, payload?: Record<string, any>, opts: EnqueueOptions = {}): Promise<Job | null> {
    if (opts.dedupeKey) {
      const existing = await this.repo.findOne({ where: { dedupeKey: opts.dedupeKey } });
      if (existing && !TERMINAL.includes(existing.status)) {
        return null;
      }
    }
    const job = this.repo.create({
      userId,
      type,
      status: 'pending',
      payload: payload ?? null,
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? 3,
      availableAt: opts.availableAt ?? new Date(),
      dedupeKey: opts.dedupeKey ?? null,
    });
    return this.repo.save(job);
  }

  /**
   * Atomically claim up to `batch` due jobs for a worker. The conditional
   * UPDATE on status='pending' guarantees only one worker wins each row, so no
   * SKIP LOCKED / MySQL-8 requirement. Fine for low-concurrency workloads.
   */
  async claimNext(workerId: string, batch: number): Promise<Job[]> {
    const now = new Date();
    const candidates = await this.repo.find({
      where: { status: 'pending', availableAt: LessThanOrEqual(now) },
      order: { availableAt: 'ASC', id: 'ASC' },
      take: batch,
    });
    const claimed: Job[] = [];
    for (const candidate of candidates) {
      const res = await this.repo.update(
        { id: candidate.id, status: 'pending' },
        { status: 'running', lockedAt: now, lockedBy: workerId, attempts: candidate.attempts + 1 },
      );
      if (res.affected === 1) {
        candidate.status = 'running';
        candidate.lockedAt = now;
        candidate.lockedBy = workerId;
        candidate.attempts = candidate.attempts + 1;
        claimed.push(candidate);
      }
    }
    return claimed;
  }

  async markCompleted(job: Job, result?: JobResult | null): Promise<void> {
    job.status = 'completed';
    job.result = result ?? null;
    job.progress = 100;
    job.completedAt = new Date();
    job.error = null;
    await this.repo.save(job);
  }

  /**
   * Fail with retry: reschedule with exponential backoff until maxAttempts,
   * then mark terminally failed.
   */
  async markFailed(job: Job, error: string): Promise<void> {
    job.error = (error ?? '').slice(0, 5000);
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      job.completedAt = new Date();
    } else {
      job.status = 'pending';
      job.lockedAt = null;
      job.lockedBy = null;
      job.availableAt = new Date(Date.now() + this.backoffMs(job.attempts));
    }
    await this.repo.save(job);
  }

  private backoffMs(attempts: number): number {
    // 30s, 60s, 120s, ... capped at 30min
    return Math.min(30_000 * 2 ** (attempts - 1), 30 * 60_000);
  }
}
