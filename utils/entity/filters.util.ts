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