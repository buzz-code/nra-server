import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { IsNotEmpty, MaxLength } from 'class-validator';

@Entity()
@Unique(['userId', 'entity'])
export class MailAddress {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    alias: string;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    entity: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}