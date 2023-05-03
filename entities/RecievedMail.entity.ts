import { MailData } from "@shared/utils/mail/interface";
import { IsNotEmpty, MaxLength } from "class-validator";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class RecievedMail {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @Column('simple-json')
    mailData: MailData;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    from: string;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    to: string;

    @Column('text', { nullable: true })
    subject: string;

    @Column('text', { nullable: true })
    body: string;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    entityName: string;

    @Column('simple-array')
    importFileIds: number[];

    @CreateDateColumn()
    createdAt: Date;
}