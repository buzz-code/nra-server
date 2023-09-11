export function fillDefaultReportDateValue(item: { id: number, reportDate: Date }) {
    if (!item.id && !item.reportDate) {
        item.reportDate = new Date();
    }
}

export function cleanDateFields(item: any, fields: string[]) {
    for (const field of fields) {
        if (item[field] && typeof item[field] === 'string' && item[field].length === 24) {
            item[field] = item[field].substr(0, 10);
        }
    }
}
