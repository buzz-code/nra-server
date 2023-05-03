import { IsNotEmpty, MaxLength } from "class-validator";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class ImportFile {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    fileName: string;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    fileSource: ImportFileSource;

    @Column('simple-array')
    entityIds: number[];

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    entityName: string;

    @IsNotEmpty({ always: true })
    @MaxLength(255, { always: true })
    @Column()
    response: string;

    @CreateDateColumn()
    createdAt: Date;
}

export enum ImportFileSource {
    UploadFile = 'קובץ שהועלה',
    Email = 'נשלח במייל',
}
