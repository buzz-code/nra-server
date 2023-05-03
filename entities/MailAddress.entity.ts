import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { CrudValidationGroups } from "@dataui/crud";

@Entity()
@Unique(['userId', 'entity'])
export class MailAddress {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { always: true })
    @Column()
    alias: string;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { always: true })
    @Column()
    entity: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}