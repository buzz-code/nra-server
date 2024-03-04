import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { IsOptional } from 'class-validator';
import { CrudValidationGroups } from "@dataui/crud";
import { IsNotEmpty, IsUniqueCombination, MaxLength } from "@shared/utils/validation/class-validator-he";
import { Type } from "class-transformer";

@Entity()
@Unique(['userId', 'entity'])
export class MailAddress {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @Type(() => String)
    @MaxLength(255, { always: true })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    alias: string;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @Type(() => String)
    @MaxLength(255, { always: true })
    @IsUniqueCombination(['userId'], [MailAddress], { always: true })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    entity: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}