import { CrudValidationGroups } from '@dataui/crud';
import { IsOptional } from 'class-validator';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { IsNotEmpty, MaxLength } from '@shared/utils/validation/class-validator-he';
import { StringType } from '@shared/utils/entity/class-transformer';
import { CreatedAtColumn, UpdatedAtColumn } from '@shared/utils/entity/column-types.util';
import { IHasUserId } from '@shared/base-entity/interface';
import { User } from './User.entity';

@Entity('phone_templates')
export class PhoneTemplate implements IHasUserId {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int', { name: 'user_id' })
  @Index('phone_template_user_id_idx')
  userId: number;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @StringType
  @MaxLength(100, { groups: [CrudValidationGroups.CREATE] })
  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column({ length: 100 })
  name: string;

  @IsOptional({ always: true })
  @StringType
  @MaxLength(500, {})
  @Column({ length: 500, nullable: true })
  description: string;

  @IsOptional({ always: true })
  @StringType
  @MaxLength(255, {})
  @Column({ name: 'yemot_template_id', nullable: true })
  yemotTemplateId: string;

  @Column({ name: 'message_type', type: 'varchar', length: 50, default: 'text' })
  messageType: string;

  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @StringType
  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column({ name: 'message_text', type: 'text' })
  messageText: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @IsOptional({ always: true })
  @StringType
  @MaxLength(20, {})
  @Column({ name: 'caller_id', length: 20, nullable: true })
  callerId: string;

  @Column('simple-json', { nullable: true })
  settings: PhoneTemplateSettings;

  @CreatedAtColumn()
  createdAt: Date;

  @UpdatedAtColumn()
  updatedAt: Date;
}

export interface PhoneTemplateSettings {
  maxRetries?: number;
  retryDelay?: number;
  timeWindow?: { start: string; end: string };
}
