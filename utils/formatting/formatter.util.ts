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

export const getISODateFormatter = (value: string) =>
    row => formatISODate(getValueByPath(row, value));

export const formatISODate = (value: any) =>
    value && new Date(value).toString() !== 'Invalid Date' ? new Date(value).toISOString() : null;

export const getHebrewBooleanFormatter = (value: string) =>
    row => formatHebrewBoolean(getValueByPath(row, value));

export const formatHebrewBoolean = (value: any) => {
    if (value === null || value === undefined) {
        return null;
    }
    return value ? 'כן' : 'לא';
};

export const getTimeFormatter = (value: string) =>
    row => formatTime(getValueByPath(row, value));

export const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes}`;
};

export const getDateFormatter = (value: string) =>
    row => formatDate(getValueByPath(row, value));

export const formatDate = (value: any) => {
    if (!value || new Date(value).toString() === 'Invalid Date') return null;
    const date = new Date(value);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
};

export const getDisplayNameFormatter = (value: string) =>
    row => formatDisplayName(getValueByPath(row, value));

export const formatDisplayName = (value: any) => {
    if (!value) return null;
    if (typeof value !== 'object') return null;
    if ('displayName' in value && value.displayName) return value.displayName;
    if ('name' in value && value.name) return value.name;
    return null;
}
