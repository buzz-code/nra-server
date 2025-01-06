import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { DataSource, Not } from "typeorm";
import { getDataSource } from '../entity/foreignKey.util';
import { getUserIdFromUser } from '@shared/auth/auth.util';
import { getCurrentUser } from './current-user.util';
import { getCurrentHebrewYear } from '../entity/year.util';
import { getCurrentId } from '../entity/current-id.util';

export function IsUniqueCombination(otherProperties: string[] = [], entities: Function[] = [], validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'IsUniqueCombination',
            target: object.constructor,
            propertyName: propertyName,
            constraints: [otherProperties.concat([propertyName]).filter(prop => prop !== 'userId').join(', ')],
            options: {
                message: 'there is already a record with same values for this user and $constraint1',
                ...validationOptions
            },
            validator: {
                async validate(value: any, args: ValidationArguments) {
                    if (!value) return true;

                    const fullObject = args.object as any;
                    const currentId = fullObject.id ?? getCurrentId() ?? -1;

                    const uniqueObject = {
                        [propertyName]: value,
                        id: Not(currentId),
                    };
                    for (const uniqueProperty of otherProperties) {
                        switch (uniqueProperty) {
                            case 'userId':
                                const user = getCurrentUser();
                                uniqueObject[uniqueProperty] = fullObject[uniqueProperty] ?? getUserIdFromUser(user);
                                break;
                            case 'year':
                                uniqueObject[uniqueProperty] = fullObject[uniqueProperty] ?? getCurrentHebrewYear();
                                break;
                            default:
                                uniqueObject[uniqueProperty] = fullObject[uniqueProperty];
                        }
                    }

                    let dataSource: DataSource;
                    try {
                        dataSource = await getDataSource(entities);
                        const count = await dataSource.getRepository(object.constructor)
                            .countBy(uniqueObject);
                        return count === 0;
                    } finally {
                        dataSource?.destroy();
                    }
                },
            },
        });
    };
}
