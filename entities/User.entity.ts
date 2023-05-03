import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import * as bcrypt from 'bcrypt';
import { IsNotEmpty, MaxLength } from "class-validator";

@Entity("users")
export abstract class User {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @IsNotEmpty({ always: true })
  @MaxLength(500, { always: true })
  @Column("varchar", { name: "name", length: 500 })
  name: string;

  @IsNotEmpty({ always: true })
  @MaxLength(500, { always: true })
  @Column("varchar", { name: "email", nullable: true, length: 500 })
  email: string | null;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
  // @ApiProperty()
  // @Column()//({select: false})
  // @Exclude()
  // password: string;
  @Column("varchar", { name: "password", nullable: true, length: 500 })
  password: string | null;

  @IsNotEmpty({ always: true })
  @MaxLength(11, { always: true })
  @Column("varchar", { name: "phone_number", nullable: true, length: 11 })
  phoneNumber: string | null;

  @Column("tinyint", { name: "active", nullable: true })
  active: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: 'timestamp' })
  updatedAt: Date;

  @Column({ nullable: true })
  effective_id: number;

  @Column("simple-json", { nullable: true })
  permissions: any;

  @Column("simple-json", { nullable: true })
  additionalData: any;

  @Column("simple-json", { nullable: true })
  userInfo: any;
}
