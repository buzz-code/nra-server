import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Not } from "typeorm";
import { getDataSource } from '../entity/foreignKey.util';

export function IsUniqueCombination(otherProperties: string[] = [], entities: Function[] = [], validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'IsUniqueCombination',
            target: object.constructor,
            propertyName: propertyName,
            constraints: [otherProperties.concat([propertyName].join(', '))],
            options: {
                message: 'there is already a record with same values for $constraint1',
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
                        uniqueObject[uniqueProperty] = fullObject[uniqueProperty];
                    }

                    const idFilter = fullObject.id ? Not({ id: fullObject.id }) : {};
                    const dataSource = await getDataSource(entities);
                    return dataSource.getRepository(object.constructor)
                        .countBy([uniqueObject, idFilter],)
                        .then(res => res === 0);
                },
            },
        });
    };
}
