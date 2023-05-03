import { CrudValidationGroups } from "@dataui/crud";
import { IsNotEmpty, IsOptional, MaxLength } from "class-validator";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class AuditLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    entityId: number;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @Column()
    entityName: string;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @Column()
    operation: string;

    @Column('simple-json')
    entityData: any;

    @CreateDateColumn()
    createdAt: Date;
}