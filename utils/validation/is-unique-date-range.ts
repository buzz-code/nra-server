import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { DataSource, LessThanOrEqual, MoreThanOrEqual, Not } from "typeorm";
import { getDataSource } from '../entity/foreignKey.util';
import { getUserIdFromUser } from '@shared/auth/auth.util';
import { getCurrentUser } from './current-user.util';
import { getCurrentId } from '../entity/current-id.util';

export function IsUniqueDateRange(
    startDateField: string = 'startDate',
    endDateField: string = 'endDate',
    entities: Function[] = [],
    validationOptions?: ValidationOptions
) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'IsUniqueDateRange',
            target: object.constructor,
            propertyName: propertyName,
            constraints: [startDateField, endDateField],
            options: {
                message: 'there is already a record with overlapping dates for this user between $constraint1 and $constraint2',
                ...validationOptions
            },
            validator: {
                async validate(value: any, args: ValidationArguments) {
                    if (!value) return true;

                    const fullObject = args.object as any;
                    const startDate = fullObject[startDateField];
                    const endDate = fullObject[endDateField];

                    if (!startDate || !endDate) return true;

                    const user = getCurrentUser();

                    const whereConditions: any = {
                        [startDateField]: LessThanOrEqual(endDate),
                        [endDateField]: MoreThanOrEqual(startDate),
                        userId: fullObject.userId ?? getUserIdFromUser(user),
                        id: Not(fullObject.id ?? getCurrentId() ?? -1),
                    };

                    let dataSource: DataSource;
                    try {
                        dataSource = await getDataSource(entities);
                        const count = await dataSource.getRepository(object.constructor)
                            .countBy(whereConditions);
                        return count === 0;
                    } finally {
                        dataSource?.destroy();
                    }
                },
            },
        });
    };
}
