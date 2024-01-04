import { formatJewishDateInHebrew, toJewishDate } from 'jewish-date';

export const getPercentsFormatter = (value: string) =>
    row => formatPercent(row[value]);

export const formatPercent = (value: any) =>
    value && !isNaN(value) ? `${Math.round(Number(value) * 100)}%` : null;

export const getHebrewDateFormatter = (value: string) =>
    row => formatHebrewDate(row[value]);

export const formatHebrewDate = (value: any) =>
    value ? formatJewishDateInHebrew(toJewishDate(new Date(value))) : null;
