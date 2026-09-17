import { Transform, TransformFnParams, Type } from "class-transformer";

export const StringType = Type(() => String);
export const NumberType = Transform((params: TransformFnParams) => {
    return isNaN(Number(params.value)) ? params.value : Number(params.value);
});
export const DateType = Transform((params: TransformFnParams) => {
    return isNaN(Date.parse(params.value)) ? params.value : new Date(params.value);
});

export const BooleanType = Transform((params: TransformFnParams) => {
    const value = params.value;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const trueValues = ['true', '1', 'כן', 'yes'];
        if (trueValues.includes(value.trim().toLowerCase())) {
            return true;
        }
        const falseValues = ['false', '0', 'לא', 'no'];
        if (falseValues.includes(value.trim().toLowerCase())) {
            return false;
        }
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    return value;
});