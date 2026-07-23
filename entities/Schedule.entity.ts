import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BooleanIntColumn, CreatedAtColumn, JsonColumn, UpdatedAtColumn } from '@shared/utils/entity/column-types.util';
import { IHasUserId } from '@shared/base-entity/interface';
import { User } from './User.entity';

/**
 * A recurring job definition. Edited as data (no redeploy). The
 * ScheduleHeartbeatService scans due rows every minute and enqueues a Job.
 */
@Entity('schedules')
export class Schedule implements IHasUserId {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int', { name: 'user_id' })
  @Index('schedule_user_id_idx')
  userId: number;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 255 })
  name: string;

  /** Job handler key to enqueue, e.g. 'cleanup-old-jobs'. */
  @Column({ name: 'job_type', length: 100 })
  jobType: string;

  @JsonColumn({ nullable: true })
  payload: Record<string, any>;

  /** Standard 5-field cron expression, e.g. '0 18 * * 5' (Friday 18:00). */
  @Column({ name: 'cron_expression', length: 120 })
  cronExpression: string;

  @Column({ name: 'time_zone', length: 60, default: 'Asia/Jerusalem' })
  timeZone: string;

  @BooleanIntColumn({ default: true })
  active: boolean;

  @Column({ name: 'next_run_at', type: 'datetime', nullable: true })
  @Index('schedule_next_run_at_idx')
  nextRunAt: Date;

  @Column({ name: 'last_run_at', type: 'datetime', nullable: true })
  lastRunAt: Date;

  @CreatedAtColumn()
  createdAt: Date;

  @UpdatedAtColumn()
  updatedAt: Date;
}
