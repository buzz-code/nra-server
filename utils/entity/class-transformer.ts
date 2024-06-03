import { Type } from "class-transformer";

export const StringType = Type(() => String);
export const NumberType = Type(() => Number);
export const DateType = Type(() => Date);