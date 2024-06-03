import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { IsOptional } from 'class-validator';
import { CrudValidationGroups } from "@dataui/crud";
import { IsNotEmpty, IsUniqueCombination, MaxLength } from "@shared/utils/validation/class-validator-he";
import { StringType } from "@shared/utils/entity/class-transformer";

export enum ImageTargetEnum {
    reportLogo = 'לוגו לתעודה',
    reportBottomLogo = 'לוגו לתחתית התעודה',
}

export class FileData {
    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column('mediumtext')
    src: string;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column('text')
    title: string;
}

@Entity()
@Unique(['userId', 'imageTarget'])
export class Image {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column(() => FileData)
    fileData: FileData;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @MaxLength(255, { always: true })
    @IsUniqueCombination(['userId'], [Image], { always: true })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    imageTarget: ImageTargetEnum;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
