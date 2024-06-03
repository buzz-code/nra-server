import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import * as bcrypt from 'bcrypt';
import { IsOptional } from "class-validator";
import { CrudValidationGroups } from "@dataui/crud";
import { IsNotEmpty, MaxLength } from "@shared/utils/validation/class-validator-he";
import { StringType } from "@shared/utils/entity/class-transformer";

@Entity("users")
export abstract class User {
  @PrimaryGeneratedColumn({ type: "int", name: "id" })
  id: number;

  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @StringType
  @MaxLength(500, {})
  @IsNotEmpty({ groups: [CrudValidationGroups.CREATE] })
  @Column("varchar", { name: "name", length: 500 })
  name: string;

  @IsOptional({ always: true })
  @StringType
  @MaxLength(500, {})
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

  @IsOptional({ always: true })
  @StringType
  @MaxLength(11, {})
  @Index("user_phone_number_idx")
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

  @Column({ default: false })
  isPaid: boolean;

  @IsOptional({ always: true })
  @StringType
  @MaxLength(255, {})
  @Column({ nullable: true })
  paymentMethod: string;

  @IsOptional({ always: true })
  @StringType
  @MaxLength(255, {})
  @Column({ nullable: true })
  mailAddressAlias: string;

  @IsOptional({ always: true })
  @StringType
  @MaxLength(255, {})
  @Column({ nullable: true })
  mailAddressTitle: string;

  @Column({ nullable: true })
  @IsOptional({ always: true })
  paymentTrackId: number;

  @Column({ nullable: true })
  @IsOptional({ always: true })
  bccAddress: string;
}
