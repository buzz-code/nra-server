import { IsNotEmpty, MaxLength } from "class-validator";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class AuditLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsNotEmpty({ always: true })
    @Column()
    entityId: number;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    entityName: string;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    operation: string;

    @Column('simple-json')
    entityData: any;

    @CreateDateColumn()
    createdAt: Date;
}