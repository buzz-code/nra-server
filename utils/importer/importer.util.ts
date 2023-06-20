import * as XLSX from 'xlsx';

export function isExcelFileExtension(filename: string) {
    const supported = [
        "xlsx",
        "xlsm",
        "xlsb",
        "xls",
        "xls",
        "xls",
        "xls",
        "xls",
        "xls",
        "numbers",
        "ods",
        "fods",
        "wk3",
        "csv",
        "txt",
        "sylk",
        "html",
        "dif",
        "dbf",
        "wk1",
        "rtf",
        "prn",
        "eth"
    ];
    const ext = filename.split('.').pop();
    return supported.includes(ext);
}

export async function parseExcelFile(base64String: string, fields: string[]): Promise<any[]> {
    const workbook = XLSX.read(base64String, { type: 'base64' });
    const worksheet = getFirstWorksheet(workbook);
    const data = XLSX.utils.sheet_to_json(worksheet, { header: fields, range: 1 });
    return data;
}

function getFirstWorksheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
    const wsname = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[wsname];
    return worksheet;
}
