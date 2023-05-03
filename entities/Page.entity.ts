import { CrudValidationGroups } from "@dataui/crud";
import { IsNotEmpty, IsOptional, MaxLength } from "class-validator";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";


@Entity()
export class Page {
  @PrimaryGeneratedColumn()
  id: number;

  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @MaxLength(255, { always: true })
  @Column()
  path: string;

  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @MaxLength(255, { always: true })
  @Column()
  description: string;

  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column('longtext')
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
