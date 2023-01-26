import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import * as bcrypt from 'bcrypt';

@Entity("users")
export abstract class User {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @Column("varchar", { name: "name", length: 500 })
  name: string;

  @Column("varchar", { name: "email", nullable: true, length: 500 })
  email: string | null;

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10);
  }
  // @ApiProperty()
  // @Column()//({select: false})
  // @Exclude()
  // password: string;
  @Column("varchar", { name: "password", nullable: true, length: 500 })
  password: string | null;

  @Column("varchar", { name: "phone_number", nullable: true, length: 11 })
  phoneNumber: string | null;

  @Column("tinyint", { name: "active", nullable: true })
  active: number | null;

  @Column("timestamp", {
    name: "created_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @Column("timestamp", {
    name: "updated_at",
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date;

  @Column({ nullable: true })
  effective_id: number;

  @Column("simple-json", { nullable: true })
  permissions: any;

  @Column("simple-json", { nullable: true })
  additionalData: any;
}
