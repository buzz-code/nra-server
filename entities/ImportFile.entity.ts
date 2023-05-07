import { CrudValidationGroups } from "@dataui/crud";
import { IsOptional } from "class-validator";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { IsNotEmpty, MaxLength } from "@shared/utils/validation/class-validator-he";

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
