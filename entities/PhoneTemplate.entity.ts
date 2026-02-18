import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { IHasUserId } from "@shared/base-entity/interface";
import { IsOptional } from "class-validator";
import { CrudValidationGroups } from "@dataui/crud";
import { IsNotEmpty, MaxLength } from "@shared/utils/validation/class-validator-he";
import { StringType } from "@shared/utils/entity/class-transformer";
import { CreatedAtColumn, UpdatedAtColumn } from "@shared/utils/entity/column-types.util";

@Index("phone_template_user_id_idx", ["userId"], {})
@Index("phone_template_name_idx", ["name"], {})
@Entity("phone_template")
export class PhoneTemplate implements IHasUserId {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("int", { name: "user_id" })
  userId: number;

  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @StringType
  @MaxLength(255, { always: true })
  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column("varchar", { name: "name", length: 255 })
  name: string;

  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @StringType
  @MaxLength(1000, { always: true })
  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column("varchar", { name: "message", length: 1000 })
  message: string;

  @CreatedAtColumn()
  createdAt: Date;

  @UpdatedAtColumn()
  updatedAt: Date;
}
