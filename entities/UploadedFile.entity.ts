import { CrudValidationGroups } from "@dataui/crud";
import { IsOptional } from "class-validator";
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { IsNotEmpty, MaxLength } from "@shared/utils/validation/class-validator-he";
import { StringType } from "@shared/utils/entity/class-transformer";
import { CreatedAtColumn, UpdatedAtColumn } from "@shared/utils/entity/column-types.util";
import { IHasUserId } from "@shared/base-entity/interface";
import { FileData } from "./Image.entity";

@Entity("uploaded_files")
export class UploadedFile implements IHasUserId {
    @PrimaryGeneratedColumn()
    id: number;

    @Column("int", { name: "user_id" })
    @Index("uploaded_files_user_id_idx")
    userId: number;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @MaxLength(255, { groups: [CrudValidationGroups.CREATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column()
    title: string;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @StringType
    @MaxLength(500, { groups: [CrudValidationGroups.CREATE] })
    @Column({ nullable: true })
    description: string;

    @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
    @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
    @Column(() => FileData)
    fileData: FileData;

    @CreatedAtColumn()
    createdAt: Date;

    @UpdatedAtColumn()
    updatedAt: Date;
}
