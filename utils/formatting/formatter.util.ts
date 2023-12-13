export const getPercentsFormatter = (value: string) =>
    row => formatPercent(row[value]);

export const formatPercent = (value: any) =>
    value && !isNaN(value) ? `${Math.round(Number(value) * 100)}%` : null;
