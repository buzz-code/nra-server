import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CreatedAtColumn, DateColumn, UpdatedAtColumn } from '@shared/utils/entity/column-types.util';
import { IHasUserId } from '@shared/base-entity/interface';
import { User } from './User.entity';
import { PhoneTemplate } from './PhoneTemplate.entity';

export type PhoneCampaignStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

@Entity('phone_campaigns')
export class PhoneCampaign implements IHasUserId {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int', { name: 'user_id' })
  @Index('phone_campaign_user_id_idx')
  userId: number;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('int', { name: 'phone_template_id' })
  @Index('phone_campaign_template_id_idx')
  phoneTemplateId: number;

  @ManyToOne(() => PhoneTemplate, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'phone_template_id' })
  phoneTemplate: PhoneTemplate;

  @Column({ name: 'yemot_campaign_id', nullable: true })
  yemotCampaignId: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  @Index('phone_campaign_status_idx')
  status: PhoneCampaignStatus;

  @Column({ name: 'total_phones', type: 'int', default: 0 })
  totalPhones: number;

  @Column({ name: 'successful_calls', type: 'int', default: 0 })
  successfulCalls: number;

  @Column({ name: 'failed_calls', type: 'int', default: 0 })
  failedCalls: number;

  @Column('simple-json', { name: 'phone_numbers' })
  phoneNumbers: PhoneEntry[];

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @CreatedAtColumn()
  createdAt: Date;

  @UpdatedAtColumn()
  updatedAt: Date;

  @DateColumn({ name: 'completed_at', nullable: true, type: 'datetime' })
  completedAt: Date;
}

export interface PhoneEntry {
  phone: string;
  name?: string;
  metadata?: Record<string, any>;
}
