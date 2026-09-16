import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { applyDecorators } from '@nestjs/common';

export function IsDigitsOnly(maxLength?: number, validationOptions?: ValidationOptions) {
    return applyDecorators(
        // Coerce a finite numeric input (e.g. a cell parsed from an Excel/CSV
        // upload) to its string form so it passes the digits-only check. Applied
        // centrally here so every IsDigitsOnly field gets it for free, instead of
        // repeating an explicit @StringType per entity.
        Transform((params: TransformFnParams) =>
            typeof params.value === 'number' && Number.isFinite(params.value) ? String(params.value) : params.value,
        ),
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
