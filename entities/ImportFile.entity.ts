import { CrudValidationGroups } from "@dataui/crud";
import { IsNotEmpty, IsOptional, MaxLength } from "class-validator";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class ImportFile {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @Column()
    fileName: string;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @Column()
    fileSource: ImportFileSource;

    @Column('simple-array')
    entityIds: number[];

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @Column()
    entityName: string;

    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @Column()
    response: string;

    @CreateDateColumn()
    createdAt: Date;
}

export enum ImportFileSource {
    UploadFile = 'קובץ שהועלה',
    Email = 'נשלח במייל',
}
