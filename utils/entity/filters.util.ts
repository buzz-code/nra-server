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

export function getDateRange(startDate: Date, endDate: Date): Date[] {
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const dates: Date[] = [];
    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}