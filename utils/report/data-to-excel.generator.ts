import * as ExcelJS from 'exceljs';
import { ISpecialField } from "../importer/types";
import { BaseReportGenerator } from './report.generators';
import { CommonFileFormat } from './types';
import { IHeader } from '../exporter/types';

export interface IDataToExcelReportGenerator {
    headerRow: string[];
    formattedData: (string | number)[][];
    sheetName?: string;
    specialFields?: ISpecialField[];
    headerConfig?: IHeader[];
}
export class DataToExcelReportGenerator extends BaseReportGenerator<IDataToExcelReportGenerator, IDataToExcelReportGenerator> {
    fileFormat: CommonFileFormat = CommonFileFormat.Excel;

    async getFileBuffer(data: IDataToExcelReportGenerator): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        const sheetName = data.sheetName || 'גליון1';
        const worksheet = workbook.addWorksheet(sheetName.replace(/\'$$/, ''));

        this.insertSpecialFields(worksheet, data.specialFields);
        const headerRow = this.addTable(worksheet, data);

        this.protectSheet(worksheet, headerRow, data.headerConfig);

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    private insertSpecialFields(worksheet: ExcelJS.Worksheet, specialFields: ISpecialField[]) {
        specialFields?.forEach(field => {
            while (worksheet.rowCount <= field.cell.r) {
                worksheet.addRow([' ']);
            }
            worksheet.getCell(field.cell.r + 1, field.cell.c + 1).value = field.value;
            worksheet.getCell(field.cell.r + 1, field.cell.c + 1).dataValidation = field.dataValidation;
            worksheet.getCell(field.cell.r + 1, field.cell.c + 1).style = field.style;
        });
    }

    private addTable(worksheet: ExcelJS.Worksheet, data: IDataToExcelReportGenerator) {
        if (!data.headerRow.length) return;

        const tableFirstRow = worksheet.rowCount + 1;
        worksheet.views = [
            { state: 'frozen', xSplit: tableFirstRow, rightToLeft: true }
        ];
        worksheet.addTable({
            name: 'data',
            ref: `A${tableFirstRow}`,
            headerRow: true,
            style: {
                theme: 'TableStyleMedium2',
                showRowStripes: true,
            },
            columns: data.headerRow.map(name => ({ name })),
            rows: data.formattedData,
        });
        worksheet.columns.forEach((column, index) => {
            column.width = this.getColumnWidth(data.formattedData, index);
        });

        return tableFirstRow;
    }

    private getColumnWidth(data: any[][], columnIndex: number, minWidth = 12) {
        return Math.max(minWidth, ...data.map(item => item[columnIndex]).map(String).map(item => item.length));
    }

    private protectSheet(worksheet: ExcelJS.Worksheet, headerRow: number, headerConfig?: IHeader[]) {
        // TODO: compare with Harbor, plan how to do protection for teacher report file
        if (!headerConfig?.some(header => typeof header !== 'string' && header.readOnly)) return;

        headerConfig?.forEach((header, colIndex) => {
            if (typeof header !== 'string' && header.readOnly) {
                worksheet.getColumn(colIndex + 1).protection = {
                    locked: true
                };
            } else {
                worksheet.getColumn(colIndex + 1).protection = {
                    locked: false
                };
            }
        });

        const headerCells = worksheet.getRow(headerRow);
        headerCells.eachCell((cell) => {
            cell.protection = {
                locked: true,
            };
        });

        worksheet.protect('1234', {
            autoFilter: true,
            sort: true,
            insertRows: true,
            insertColumns: true,
            deleteRows: true,
            deleteColumns: true,
            formatCells: true,
            formatColumns: true,
            formatRows: true,
            selectLockedCells: true,
            selectUnlockedCells: true
        });
    }
}

export function getIntegerDataValidation(allowBlank = true, error = 'הערך חייב להיות מספר חיובי', errorTitle = 'הערך אינו מספר חיובי'): ExcelJS.DataValidation {
    return {
        type: 'whole',
        operator: 'between',
        formulae: [0, 999],
        allowBlank,
        error,
        errorTitle,
        errorStyle: 'warning',
        prompt: error,
        promptTitle: errorTitle,
        showErrorMessage: true,
        showInputMessage: true,
    }
}

export function getDateDataValidation(allowBlank = true, error = 'הערך חייב להיות תאריך תקין', errorTitle = 'הערך אינו תאריך תקין'): ExcelJS.DataValidation {
    return {
        type: 'date',
        formulae: [`=DATE(${new Date().getFullYear()}, ${new Date().getMonth() + 1}, ${new Date().getDate()})`],
        allowBlank,
        error,
        errorTitle,
        errorStyle: 'warning',
        prompt: error,
        promptTitle: errorTitle,
        showErrorMessage: true,
        showInputMessage: true,
    }
}
