import {
    ValidationOptions,
    IsNotEmpty as _IsNotEmpty,
    MaxLength as _MaxLength,
} from "class-validator";

export const IsNotEmpty = (validationOptions?: ValidationOptions): PropertyDecorator =>
    _IsNotEmpty({ ...validationOptions, message: 'הערך של $property לא יכול להיות ריק' });
export const MaxLength = (max: number, validationOptions?: ValidationOptions): PropertyDecorator =>
    _MaxLength(max, { ...validationOptions, message: '$property לא יכול להיות ארוך יותר מ-$constraint1 תווים' });
