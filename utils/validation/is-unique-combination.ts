import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { DataSource, Not } from "typeorm";
import { getDataSource } from '../entity/foreignKey.util';
import { getUserIdFromUser } from '@shared/auth/auth.util';
import { getCurrentUser } from './util';

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
                    const uniqueObject = {
                        [propertyName]: value,
                    };
                    for (const uniqueProperty of otherProperties) {
                        if (uniqueProperty === 'userId') {
                            const user = getCurrentUser();
                            uniqueObject[uniqueProperty] = fullObject[uniqueProperty] ?? getUserIdFromUser(user);
                        } else {
                            uniqueObject[uniqueProperty] = fullObject[uniqueProperty];
                        }
                    }
                    if (fullObject.id) {
                        uniqueObject.id = Not(fullObject.id);
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
