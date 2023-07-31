export function fillDefaultReportDateValue(item: { id: number, reportDate: Date }) {
    if (!item.id && !item.reportDate) {
        item.reportDate = new Date();
    }
}
