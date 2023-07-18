import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Not } from "typeorm";
import { RequestContext } from "nestjs-request-context";
import { getDataSource } from '../entity/foreignKey.util';
import { getUserIdFromUser } from '@shared/auth/auth.service';

function getCurrentUser() {
    const req = RequestContext.currentContext.req;
    return req.user;
}

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

                    const idFilter = fullObject.id ? Not({ id: fullObject.id }) : {};
                    const dataSource = await getDataSource(entities);
                    return dataSource.getRepository(object.constructor)
                        .countBy([uniqueObject, idFilter])
                        .then(res => res === 0);
                },
            },
        });
    };
}
