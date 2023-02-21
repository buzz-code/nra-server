import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class ImportFile {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @Column()
    fileName: string;

    @Column('simple-array')
    entityIds: number[];

    @Column()
    entityName: string;

    @CreateDateColumn()
    createdAt: Date;
}