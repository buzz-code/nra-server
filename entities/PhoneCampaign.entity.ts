import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { IHasUserId } from "@shared/base-entity/interface";
import { PhoneTemplate } from "./PhoneTemplate.entity";
import JsonTransformer from "@shared/utils/entity/jsonTransformer.util";
import { MediumTextColumn, CreatedAtColumn, UpdatedAtColumn } from "@shared/utils/entity/column-types.util";

@Index("phone_campaign_user_id_idx", ["userId"], {})
@Index("phone_campaign_template_id_idx", ["templateId"], {})
@Index("phone_campaign_status_idx", ["status"], {})
@Entity("phone_campaign")
export class PhoneCampaign implements IHasUserId {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("int", { name: "user_id" })
  userId: number;

  @Column("int", { name: "template_id" })
  templateId: number;

  @ManyToOne(() => PhoneTemplate, { onDelete: 'CASCADE' })
  template: PhoneTemplate;

  @MediumTextColumn({ name: 'recipient_ids', transformer: new JsonTransformer<number[]>() })
  recipientIds: number[];

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @MediumTextColumn({
    transformer: new JsonTransformer<any[]>(),
    nullable: true,
  })
  results: any[];

  @Column("varchar", { name: "error_message", nullable: true, length: 500 })
  errorMessage: string;

  @CreatedAtColumn()
  createdAt: Date;

  @UpdatedAtColumn()
  updatedAt: Date;
}
