import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { applyDecorators } from '@nestjs/common';

export function IsDigitsOnly(maxLength?: number, validationOptions?: ValidationOptions) {
    return applyDecorators(
        // Coerce a numeric input (e.g. a cell parsed from an Excel/CSV
        // upload) to its string form so it passes the digits-only check.
        // Matches the explicit `@StringType` used on existing string-ID
        // fields; baked in here so every IsDigitsOnly field gets the
        // transform for free instead of repeating the decorator per entity.
        Transform((params: TransformFnParams) => {
            const value = params.value;
            return typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
        }),
        function (object: Object, propertyName: string) {
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
        },
    );
}
