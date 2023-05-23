import { IHasUserId } from "@shared/base-entity/interface";
import { Text } from "@shared/entities/Text.entity";
import { User } from "@shared/entities/User.entity";
import { DataSource, PrimaryColumn, ViewColumn, ViewEntity } from "typeorm";

@ViewEntity("text_by_user", {
    expression: (dataSource: DataSource) => dataSource
        .createQueryBuilder()
        .select('CONCAT(users.id, "_", t_base.id)', 'id')
        .addSelect('users.id', 'userId')
        .addSelect('t_base.name', 'name')
        .addSelect('t_base.description', 'description')
        .addSelect('COALESCE(t_user.value, t_base.value)', 'value')
        .addSelect('t_user.id', 'overrideTextId')
        .where('t_base.userId = 0')
        .from(Text, 't_base')
        .leftJoin(User, 'users', '1 = 1')
        .leftJoin(Text, 't_user', 't_user.name = t_base.name AND t_user.user_id = users.id')
        .orderBy('users.id')
        .addOrderBy('t_base.id')
})
export class TextByUser implements IHasUserId {
    @PrimaryColumn()
    id: string;

    @ViewColumn()
    userId: number;

    @ViewColumn()
    name: string;

    @ViewColumn()
    description: string;

    @ViewColumn()
    value: string;

    @ViewColumn()
    overrideTextId: number | null;
}