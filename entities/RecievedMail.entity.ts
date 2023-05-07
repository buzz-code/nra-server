import { CrudValidationGroups } from "@dataui/crud";
import { MailData } from "@shared/utils/mail/interface";
import { IsOptional } from "class-validator";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { IsNotEmpty, MaxLength } from "@shared/utils/validation/class-validator-he";

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