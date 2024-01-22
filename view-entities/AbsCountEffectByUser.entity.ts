import { IHasUserId } from "@shared/base-entity/interface";
import { User } from "@shared/entities/User.entity";
import { AttGradeEffect } from "src/db/entities/AttGradeEffect";
import { DataSource, PrimaryColumn, ViewColumn, ViewEntity } from "typeorm";

@ViewEntity('abs_count_effect_by_user', {
    expression: (dataSource: DataSource) => dataSource
        .createQueryBuilder()
        .select('CONCAT(users.id, "_", numbers.number)', 'id')
        .addSelect('users.id', 'userId')
        .addSelect('numbers.number', 'number')
        .addSelect('MIN(att_grade_effect.effect)', 'effect')
        .from('numbers', 'numbers')
        .leftJoin(User, 'users', '1 = 1')
        .leftJoin(AttGradeEffect, 'att_grade_effect', 'att_grade_effect.user_id = users.id AND att_grade_effect.count <= numbers.number')
        .groupBy('users.id')
        .addGroupBy('numbers.number')
        .orderBy('users.id')
        .addOrderBy('numbers.number')
})
export class AbsCountEffectByUser implements IHasUserId {
    @PrimaryColumn()
    id: string;

    @ViewColumn()
    userId: number;

    @ViewColumn()
    number: number;

    @ViewColumn()
    effect: number;
}