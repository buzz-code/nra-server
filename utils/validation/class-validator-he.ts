import {
    ValidationOptions,
    IsNotEmpty as _IsNotEmpty,
    MaxLength as _MaxLength,
} from "class-validator";
import { IsUniqueCombination as _IsUniqueCombination } from "./is-unique-combination";

export const IsNotEmpty = (validationOptions?: ValidationOptions): PropertyDecorator =>
    _IsNotEmpty({ ...validationOptions, message: 'הערך של $property לא יכול להיות ריק' });
export const MaxLength = (max: number, validationOptions?: ValidationOptions): PropertyDecorator =>
    _MaxLength(max, { ...validationOptions, message: '$property לא יכול להיות ארוך יותר מ-$constraint1 תווים' });
export const IsUniqueCombination = (otherProperties: string[] = [], entities: Function[] = [], validationOptions?: ValidationOptions) =>
    _IsUniqueCombination(otherProperties, entities, { ...validationOptions, message: 'קיימת כבר רשומה עם ערכים זהים למשתמש בשדות $constraint1' });
