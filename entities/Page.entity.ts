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

  @Column()
  path: string;

  @Column()
  description: string;

  @Column('longtext')
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
