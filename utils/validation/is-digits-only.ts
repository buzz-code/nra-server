import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsDigitsOnly(maxLength?: number, validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'IsDigitsOnly',
            target: object.constructor,
            propertyName: propertyName,
            constraints: [maxLength],
            options: {
                message: '$property must contain digits only',
                ...validationOptions
            },
            validator: {
                validate(value: any, args: ValidationArguments) {
                    if (value === undefined || value === null || value === '') return true;
                    if (typeof value !== 'string' || !/^\d+$/.test(value)) return false;
                    const max = args.constraints[0];
                    return max === undefined || value.length <= max;
                },
            },
        });
    };
}
