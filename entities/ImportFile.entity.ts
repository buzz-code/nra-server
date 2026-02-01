import { CrudValidationGroups } from "@dataui/crud";
import { IsOptional } from "class-validator";
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { IsNotEmpty, MaxLength } from "@shared/utils/validation/class-validator-he";
import { StringType } from "@shared/utils/entity/class-transformer";
import { JsonColumn } from "@shared/utils/entity/column-types.util";

@Entity()
@Index("import_file_user_id_idx", ["userId"])
export class ImportFile {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    fileName: string;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    fileSource: ImportFileSource;

    @Column('simple-array')
    entityIds: number[];

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    entityName: string;

    @Column({ nullable: true })
    fullSuccess: boolean;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    response: string;

    @JsonColumn({ nullable: true })
    metadata: LessonSignatureMetadata;

    @CreateDateColumn()
    createdAt: Date;
}

export enum ImportFileSource {
    UploadFile = 'קובץ שהועלה',
    Email = 'נשלח במייל',
    AttendanceForm = 'טופס נוכחות',
}

export interface LessonSignatureMetadata {
    dateDetails?: {
        [date: string]: {    // ISO date string: "2025-10-17"
            lessonStartTime?: string;  // "HH:MM"
            lessonEndTime?: string;    // "HH:MM"
            lessonTopic?: string;      // "מתמטיקה"
        }
    };
    signatureData?: string;         // data:image/png;base64,...
    reportGroupId?: number;
}
