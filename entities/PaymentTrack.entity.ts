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


@Entity()
export class PaymentTrack {
  @PrimaryGeneratedColumn()
  id: number;

  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @StringType
  @MaxLength(255, { always: true })
  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column()
  name: string;

  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column('longtext')
  description: string;

  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column()
  monthlyPrice: number;

  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column()
  annualPrice: number;

  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column()
  studentNumberLimit: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
