import { CrudValidationGroups } from "@dataui/crud";
import { IsOptional } from "class-validator";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { IsNotEmpty, MaxLength } from "@shared/utils/validation/class-validator-he";
import { StringType } from "@shared/utils/entity/class-transformer";

@Entity()
export class AuditLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    entityId: number;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    entityName: string;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    operation: string;

    @Column('simple-json')
    entityData: any;

    @Column({ default: false })
    isReverted: boolean;

    @CreateDateColumn()
    createdAt: Date;
}