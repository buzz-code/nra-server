import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class AuditLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @Column()
    entityId: number;

    @Column()
    entityName: string;

    @Column()
    operation: string;

    @Column('simple-json')
    entityData: any;

    @CreateDateColumn()
    createdAt: Date;
}