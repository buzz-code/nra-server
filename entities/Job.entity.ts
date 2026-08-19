import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CreatedAtColumn, JsonColumn, UpdatedAtColumn } from '@shared/utils/entity/column-types.util';
import { IHasUserId } from '@shared/base-entity/interface';
import { User } from './User.entity';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * A single background job execution. Durable source of truth for the async
 * worker: rows are claimed by JobWorkerService, run by a registered handler,
 * and retried with backoff until `maxAttempts`.
 */
@Entity('jobs')
export class Job implements IHasUserId {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int', { name: 'user_id' })
  @Index('job_user_id_idx')
  userId: number;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Handler key, e.g. 'user-data-export'. */
  @Column({ length: 100 })
  @Index('job_type_idx')
  type: string;

  @Column({ length: 20, default: 'pending' })
  @Index('job_status_idx')
  status: JobStatus;

  @JsonColumn({ nullable: true })
  payload: Record<string, any>;

  @JsonColumn({ nullable: true })
  result: Record<string, any>;

  @Column('int', { default: 0 })
  progress: number;

  @Column('int', { default: 0 })
  attempts: number;

  @Column('int', { name: 'max_attempts', default: 3 })
  maxAttempts: number;

  /** Job is not eligible to run before this time (delay + retry backoff). */
  @Column({ name: 'available_at', type: 'datetime', nullable: true })
  @Index('job_available_at_idx')
  availableAt: Date;

  @Column({ name: 'locked_at', type: 'datetime', nullable: true })
  lockedAt: Date;

  @Column({ name: 'locked_by', length: 100, nullable: true })
  lockedBy: string;

  /** Optional idempotency key (e.g. schedule id + fire time) to avoid double enqueue. */
  @Column({ name: 'dedupe_key', length: 191, nullable: true })
  @Index('job_dedupe_key_idx')
  dedupeKey: string;

  @Column('text', { nullable: true })
  error: string;

  @CreatedAtColumn()
  createdAt: Date;

  @UpdatedAtColumn()
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date;
}
