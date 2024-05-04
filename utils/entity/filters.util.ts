import { Between, FindOperator, LessThanOrEqual, MoreThanOrEqual } from "typeorm";

export function getReportDateFilter(fromDate: Date, toDate: Date): FindOperator<any> {
    if (fromDate && toDate) {
        return Between(fromDate, toDate);
    }
    if (fromDate) {
        return MoreThanOrEqual(fromDate);
    }
    if (toDate) {
        return LessThanOrEqual(toDate);
    }
}

export function dateFromString(dateStr: string): Date {
    const dateObj = new Date(dateStr);
    if (dateObj.toString() === 'Invalid Date') {
        return null;
    }
    return dateObj;
}