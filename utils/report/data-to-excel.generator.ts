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
        if (data.headerRow.length > 0) {
            this.addTable(worksheet, data);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    private insertSpecialFields(worksheet: ExcelJS.Worksheet, specialFields: ISpecialField[]) {
        specialFields?.forEach(field => {
            while (worksheet.rowCount <= field.cell.r) {
                worksheet.addRow([' ']);
            }
            worksheet.getCell(field.cell.r + 1, field.cell.c + 1).value = field.value;
        });
    }

    private addTable(worksheet: ExcelJS.Worksheet, data: IDataToExcelReportGenerator) {
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
