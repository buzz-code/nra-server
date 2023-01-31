import * as XLSX from 'xlsx';

export async function parseExcelFile(base64String: string, fields: string[]): Promise<any[]> {
    const workbook = XLSX.read(base64String, { type: 'binary' });
    const worksheet = getFirstWorksheet(workbook);
    const data = XLSX.utils.sheet_to_json(worksheet, { header: fields, range: 1 });
    return data;
}

function getFirstWorksheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
    const wsname = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[wsname];
    return worksheet;
}
