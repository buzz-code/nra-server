import * as XLSX from 'xlsx';
import { ISpecialField } from './types';

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

export async function parseExcelFile(base64String: string, fields: string[], rowsToSkip: number = 1): Promise<any[]> {
    const worksheet = getWorksheet(base64String);
    const data = XLSX.utils.sheet_to_json(worksheet, { header: fields, range: rowsToSkip });
    return data;
}

function getWorksheet(base64String: string) {
    const workbook = XLSX.read(base64String, { type: 'base64' });
    const worksheet = getFirstWorksheet(workbook);
    return worksheet
}

function getFirstWorksheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
    const wsname = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[wsname];
    return worksheet;
}

export async function parseExcelFileAdvanced(base64String: string, fields: string[], specialFields: ISpecialField[]) {
    const rowsToSkip = getNumberOfUsedRows(specialFields.map(i => i.cell));
    const specialData = getDataFromCells(base64String, specialFields);
    const data = await parseExcelFile(base64String, fields, rowsToSkip);
    const advancedData = data.map(item => ({ ...specialData, ...item }));
    return advancedData;
}

function getNumberOfUsedRows(cells: XLSX.CellAddress[]) {
    const lastUsedRow = cells.reduce((prev, cell) => Math.max(prev, cell.r), 0);
    return lastUsedRow + 1;
}

function getDataFromCells(base64String: string, specialFields: ISpecialField[]) {
    const worksheet = getWorksheet(base64String);
    const data = Object.fromEntries(
        specialFields.map(
            ({ cell, value }) => ([
                value,
                worksheet[XLSX.utils.encode_cell(cell)].v
            ])
        )
    );
    return data;
}