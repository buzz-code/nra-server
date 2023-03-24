import { MailData } from "@shared/utils/mail/interface";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class RecievedMail {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @Column('simple-json')
    mailData: MailData;

    @Column()
    from: string;

    @Column()
    to: string;

    @Column('text')
    subject: string;

    @Column('text')
    body: string;

    @Column()
    entityName: string;

    @Column('simple-array')
    importFileIds: number[];

    @CreateDateColumn()
    createdAt: Date;
}