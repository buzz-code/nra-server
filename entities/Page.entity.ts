import { CrudValidationGroups } from "@dataui/crud";
import { IsOptional } from "class-validator";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { IsNotEmpty, MaxLength } from "@shared/utils/validation/class-validator-he";
import { StringType } from "@shared/utils/entity/class-transformer";
import { LongTextColumn } from "@shared/utils/entity/column-types.util";


@Entity()
export class Page {
  @PrimaryGeneratedColumn()
  id: number;

  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @StringType
  @MaxLength(255, { always: true })
  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column()
  description: string;

  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @LongTextColumn()
  value: string;

  @Column({ nullable: true })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
