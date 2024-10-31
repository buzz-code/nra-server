import * as ExcelJS from 'exceljs/dist/exceljs.min.js';
import { ISpecialField } from "../importer/types";
import { BaseReportGenerator } from './report.generators';
import { CommonFileFormat } from './types';

export interface IDataToExcelReportGenerator {
    headerRow: string[];
    formattedData: (string | number)[][];
    sheetName?: string;
    specialFields?: ISpecialField[];
}
export class DataToExcelReportGenerator extends BaseReportGenerator<IDataToExcelReportGenerator, IDataToExcelReportGenerator> {
    fileFormat: CommonFileFormat = CommonFileFormat.Excel;

    async getFileBuffer(data: IDataToExcelReportGenerator): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        const sheetName = data.sheetName || 'גליון1';
        const worksheet = workbook.addWorksheet(sheetName.replace(/'$/, ''));

        this.insertSpecialFields(worksheet, data.specialFields);
        this.addTable(worksheet, data);

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
    }

    private getColumnWidth(data: any[][], columnIndex: number, minWidth = 12) {
        return Math.max(minWidth, ...data.map(item => item[columnIndex]).map(String).map(item => item.length));
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
