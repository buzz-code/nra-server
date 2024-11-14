import { Transform, TransformFnParams, Type } from "class-transformer";

export const StringType = Type(() => String);
export const NumberType = Transform((params: TransformFnParams) => {
    return isNaN(Number(params.value)) ? params.value : Number(params.value);
});
export const DateType = Transform((params: TransformFnParams) => {
    return isNaN(Date.parse(params.value)) ? params.value : new Date(params.value);
});