import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class ImportFile {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @Column()
    fileName: string;

    @Column()
    fileSource: ImportFileSource;

    @Column('simple-array')
    entityIds: number[];

    @Column()
    entityName: string;

    @Column()
    response: string;

    @CreateDateColumn()
    createdAt: Date;
}

export enum ImportFileSource {
    UploadFile = 'קובץ שהועלה',
    Email = 'נשלח במייל',
}
