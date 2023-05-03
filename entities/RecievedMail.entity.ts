import { CrudValidationGroups } from "@dataui/crud";
import { MailData } from "@shared/utils/mail/interface";
import { IsNotEmpty, IsOptional, MaxLength } from "class-validator";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class RecievedMail {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @Column('simple-json')
    mailData: MailData;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { always: true })
    @Column()
    from: string;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { always: true })
    @Column()
    to: string;

    @Column('text', { nullable: true })
    subject: string;

    @Column('text', { nullable: true })
    body: string;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { always: true })
    @Column()
    entityName: string;

    @Column('simple-array')
    importFileIds: number[];

    @CreateDateColumn()
    createdAt: Date;
}