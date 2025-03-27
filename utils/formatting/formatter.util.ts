import { formatJewishDateInHebrew, toJewishDate } from 'jewish-date';

export const getValueByPath = (row, key) => {
    if (!key) {
        return null;
    }
    const parts = key.split('.');
    let val = row;
    for (const part of parts) {
        val = val?.[part];
    }
    return val;
};

export const getPercentsFormatter = (value: string, fractionDigits = 0) =>
    row => formatPercent(getValueByPath(row, value), fractionDigits);

export const formatPercent = (value: any, fractionDigits = 0) =>
    (value || value === 0) && !isNaN(value) ? `${Number((Number(value) * 100).toFixed(fractionDigits))}%` : null;

export const getHebrewDateFormatter = (value: string) =>
    row => formatHebrewDate(getValueByPath(row, value));

export const formatHebrewDate = (value: any) =>
    value && new Date(value).toString() !== 'Invalid Date' ? formatJewishDateInHebrew(toJewishDate(new Date(value))) : null;

export const getJsonFormatter = (value: string) =>
    row => formatJson(getValueByPath(row, value));

export const formatJson = (value: any) =>
    value ? JSON.stringify(value) : null;
