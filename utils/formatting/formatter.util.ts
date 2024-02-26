import { formatJewishDateInHebrew, toJewishDate } from 'jewish-date';

export const getPercentsFormatter = (value: string, fractionDigits = 0) =>
    row => formatPercent(row[value], fractionDigits);

export const formatPercent = (value: any, fractionDigits = 0) =>
    (value || value === 0) && !isNaN(value) ? `${Number((Number(value) * 100).toFixed(fractionDigits))}%` : null;

export const getHebrewDateFormatter = (value: string) =>
    row => formatHebrewDate(row[value]);

export const formatHebrewDate = (value: any) =>
    value ? formatJewishDateInHebrew(toJewishDate(new Date(value))) : null;

export const getJsonFormatter = (value: string) =>
    row => formatJson(row[value]);

export const formatJson = (value: any) =>
    value ? JSON.stringify(value) : null;
