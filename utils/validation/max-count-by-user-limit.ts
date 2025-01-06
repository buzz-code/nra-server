import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { DataSource, Not } from "typeorm";
import { getDataSource } from '../entity/foreignKey.util';
import { getUserIdFromUser } from '@shared/auth/auth.util';
import { getCurrentUser } from './current-user.util';
import { getCurrentHebrewYear } from "@shared/utils/entity/year.util";

export type GetMaxLimitType = (userId: any, dataSource: DataSource) => Promise<number>;
export function MaxCountByUserLimit(entity: Function, getMaxLimit: GetMaxLimitType, entities: Function[] = [], foreignKey = 'id', validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: MaxCountByUserLimit.name,
            target: object.constructor,
            propertyName: propertyName,
            constraints: [entity.name],
            options: {
                message: 'max limit reached for $constraint1',
                ...validationOptions
            },
            validator: {
                async validate(value: any, args: ValidationArguments) {
                    const fullObject = args.object as any;
                    const user = getCurrentUser();
                    const entityFilter: any = {
                        userId: fullObject.userId ?? getUserIdFromUser(user),
                        year: fullObject.year ?? getCurrentHebrewYear(),
                    };
                    if (fullObject[foreignKey]) {
                        entityFilter.id = Not(fullObject[foreignKey]);
                    }
                    let dataSource: DataSource;
                    try {
                        dataSource = await getDataSource([entity, ...entities]);
                        const maxLimit = await getMaxLimit(entityFilter.userId, dataSource);
                        const count = await dataSource.getRepository(entity)
                            .countBy(entityFilter);
                        return count < maxLimit;
                    } catch (error) {
                        return false;
                    } finally {
                        dataSource?.destroy();
                    }
                },
            },
        });
    };
}
