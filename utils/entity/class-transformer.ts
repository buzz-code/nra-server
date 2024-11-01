import { Transform, TransformFnParams, Type } from "class-transformer";

export const StringType = Type(() => String);
export const NumberType = Type(() => Number);
export const DateType = Transform((params: TransformFnParams) => {
    return isNaN(Date.parse(params.value)) ? params.value : new Date(params.value);
});