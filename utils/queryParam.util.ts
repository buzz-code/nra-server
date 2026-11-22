export function ifNotUndefined<T>(value: T | undefined): T | undefined {
    return value !== 'undefined' ? value : undefined;
}

// An empty date input arrives in the query string as 'null' or ''
export function getAsDate(dateStr: string | null | undefined): Date | undefined {
    const val = ifNotUndefined(dateStr);
    return val === undefined || val === null || val === 'null' || val === '' ? undefined : new Date(val);
}

export function getAsString(value: string | undefined): string | undefined {
    const val = ifNotUndefined(value);
    return val !== undefined ? String(val) : undefined;
}

export function getAsBoolean(value: string | boolean | undefined): boolean | undefined {
    const val = ifNotUndefined(value);
    return val !== undefined ? String(val) === 'true' : undefined;
}

export function getAsNumber(value: string | undefined): number | undefined {
    const val = ifNotUndefined(value);
    return val !== undefined ? Number(val) : undefined;
}

export function getAsArray(value: string | undefined): string[] | undefined {
    return getAsString(value)?.split(',');
}

export function getAsNumberArray(value: string | undefined): number[] | undefined {
    return getAsArray(value)?.map(Number).filter(val => !isNaN(val));
}
