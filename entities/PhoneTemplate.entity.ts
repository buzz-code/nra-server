import { CrudValidationGroups } from "@dataui/crud";
import { IsOptional } from "class-validator";
import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { IsNotEmpty, MaxLength } from "@shared/utils/validation/class-validator-he";
import { StringType } from "@shared/utils/entity/class-transformer";
import { User } from "./User.entity";

@Entity("phone_templates")
export class PhoneTemplate {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "int" })
    @Index("phone_template_user_id_idx")
    userId: number;

    @ManyToOne(() => User)
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
    @Column({ nullable: true })
    yemotTemplateId: string;

    @Column({ type: "varchar", length: 50, default: "text" })
    messageType: "text";

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column({ type: "text" })
    messageText: string;

    @Column({ default: true })
    isActive: boolean;

    @IsOptional({ always: true })
    @StringType
    @MaxLength(20, {})
    @Column({ length: 20, nullable: true })
    callerId: string;

    @Column("simple-json", { nullable: true })
    settings: PhoneTemplateSettings;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

export interface PhoneTemplateSettings {
    maxRetries?: number;
    retryDelay?: number;
    timeWindow?: { start: string; end: string };
}
