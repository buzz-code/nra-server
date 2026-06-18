import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { DateColumn } from "@shared/utils/entity/column-types.util";
import { User } from "./User.entity";
import { PhoneTemplate } from "./PhoneTemplate.entity";

export type PhoneCampaignStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

@Entity("phone_campaigns")
export class PhoneCampaign {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "int" })
    @Index("phone_campaign_user_id_idx")
    userId: number;

    @ManyToOne(() => User)
    user: User;

    @Column({ type: "int" })
    @Index("phone_campaign_template_id_idx")
    phoneTemplateId: number;

    @ManyToOne(() => PhoneTemplate)
    phoneTemplate: PhoneTemplate;

    @Column({ nullable: true })
    yemotCampaignId: string;

    @Column({
        type: "varchar",
        length: 50,
        default: "pending",
    })
    @Index("phone_campaign_status_idx")
    status: PhoneCampaignStatus;

    @Column({ type: "int", default: 0 })
    totalPhones: number;

    @Column({ type: "int", default: 0 })
    successfulCalls: number;

    @Column({ type: "int", default: 0 })
    failedCalls: number;

    @Column("simple-json")
    phoneNumbers: PhoneEntry[];

    @Column({ type: "text", nullable: true })
    errorMessage: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DateColumn({ nullable: true })
    completedAt: Date;
}

export interface PhoneEntry {
    phone: string;
    name?: string;
    metadata?: Record<string, any>;
}
