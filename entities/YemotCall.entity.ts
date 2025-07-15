import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";
import { User } from "./User.entity";
import JsonTransformer from "@shared/utils/entity/jsonTransformer.util";
import { MediumTextColumn } from "@shared/utils/entity/column-types.util";

@Entity()
export class YemotCall {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @ManyToOne(() => User)
    user: User;

    @Index("yemot_call_api_call_id_idx")
    @Column()
    apiCallId: string;

    @Column()
    phone: string;

    @MediumTextColumn({ transformer: new JsonTransformer<YemotStep[]>() })
    history: YemotStep[];

    @Column()
    currentStep: string;

    @Column('simple-json', { nullable: true })
    data: any;

    @Column()
    isOpen: Boolean;

    @Column({ default: false })
    hasError: Boolean;

    @Column({ nullable: true })
    errorMessage: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

interface YemotStep {
    time: Date;
    params?: any;
    response: any;
}

export interface YemotParams {
    ApiCallId: string;
    ApiYFCallId: string;
    ApiDID: string;
    ApiRealDID: string;
    ApiPhone: string;
    ApiExtension: string;
    ApiTime: string;
    hangup: string;
    [key: string]: string;
}