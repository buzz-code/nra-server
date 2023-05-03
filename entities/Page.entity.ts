import { IsNotEmpty, MaxLength } from "class-validator";
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

  @IsNotEmpty({ always: true })
  @MaxLength(255, { always: true })
  @Column()
  path: string;

  @IsNotEmpty({ always: true })
  @MaxLength(255, { always: true })
  @Column()
  description: string;

  @IsNotEmpty({ always: true })
  @Column('longtext')
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
