type KeyOfType<T, V> = keyof {
    [P in keyof T as T[P] extends V ? P : never]: any
}

export function getNumericValueOrNull(val: string): number {
    return val === 'null' ? null : Number(val);
}

export function calcSum<T>(arr: T[], getValue: (item: T) => number): number {
    return arr.reduce((val, item) => val + (getValue(item) ?? 0), 0);
}

export function calcAvg<T>(arr: T[], getValue: (item: T) => number): number {
    let total = 0, count = 0;
    for (const item of arr) {
        const val = getValue(item);
        if (val !== null && val !== undefined) {
            total += val;
            count++;
        }
    }
    return total / (count || 1);
}

export function roundFractional(val: number): number {
    return +val.toFixed(4);
}

export function roundObjectProperty<T>(obj: T, key: KeyOfType<T, number>) {
    if (obj[key]) {
        obj[key] = roundFractional(obj[key] as number) as any;
    }
}

export function getUniqueValues<T, S>(arr: T[], getValue: (item: T) => S): S[] {
    return [...new Set(arr.map(getValue).filter(Boolean))];
}

export function groupDataByKeys<T>(data: T[], keys: KeyOfType<T, any>[]): Record<string, T[]> {
    return (data ?? []).reduce((a, b) => {
        const key = keys.map(k => b[k]).map(String).join('_');
        a[key] ??= [];
        a[key].push(b);
        return a;
    }, {});
}

export function groupDataByKeysAndCalc<T, V>(data: T[], keys: KeyOfType<T, any>[], getValue: (item: T[]) => V): Record<string, V> {
    const map = groupDataByKeys(data, keys);
    return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, getValue(value)]));
}

export function calcPercents(val: number, total: number): number {
    return Math.round(val / (total || 1) * 100);
}

export function keepBetween(val: number, min: number, max: number): number {
    if (min > max) {
        return keepBetween(val, max, min);
    }
    return Math.max(Math.min(val, max), min);
}

export function getItemById<T extends { id: number | string }>(arr: T[], id: T['id']): T {
    return arr.find(item => item.id === id);
}
