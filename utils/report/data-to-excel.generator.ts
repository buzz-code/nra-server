import * as ExcelJS from 'exceljs';
import { IBorderRange, IImageField, ISpecialField, SupportedImageExtension } from "../importer/types";
import { BaseReportGenerator } from './report.generators';
import { CommonFileFormat } from './types';
import { IHeader } from '../exporter/types';

export interface IDataToExcelReportGenerator {
    headerRow: string[];
    formattedData: (string | number)[][];
    sheetName?: string;
    specialFields?: ISpecialField[];
    headerConfig?: IHeader[];
    borderRanges?: IBorderRange[];
    images?: IImageField[];
}
export class DataToExcelReportGenerator<T = IDataToExcelReportGenerator> extends BaseReportGenerator<T, IDataToExcelReportGenerator> {
    fileFormat: CommonFileFormat = CommonFileFormat.Excel;

    async getFileBuffer(data: IDataToExcelReportGenerator): Promise<Buffer> {
        const { workbook, worksheet } = this.createWorkbook(data.sheetName);

        this.insertSpecialFields(worksheet, data.specialFields);
        const headerRow = this.addTable(worksheet, data);
        this.protectSheet(worksheet, headerRow, data.headerConfig);
        this.applyBorders(worksheet, data.borderRanges);
        this.addImages(workbook, worksheet, data.images);

        return this.getBufferFromWorkbook(workbook);
    }

    private createWorkbook(sheetName: string = 'גליון1') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName.replace(/\'$$/, ''));
        return { workbook, worksheet };
    }

    private getBufferFromWorkbook(workbook: ExcelJS.Workbook): Promise<Buffer> {
        return workbook.xlsx.writeBuffer().then(buffer => Buffer.from(buffer));
    }

    private insertSpecialFields(worksheet: ExcelJS.Worksheet, specialFields: ISpecialField[]) {
        specialFields?.forEach(field => {
            while (worksheet.rowCount <= field.cell.r) {
                worksheet.addRow([' ']);
            }
            const cell = worksheet.getCell(field.cell.r + 1, field.cell.c + 1);
            cell.value = field.value;
            if (field.dataValidation) {
                cell.dataValidation = field.dataValidation;
            }
            if (field.style) {
                cell.style = field.style;
            }
            if (field.merge) {
                worksheet.mergeCells(
                    field.merge.s.r + 1,
                    field.merge.s.c + 1,
                    field.merge.e.r + 1,
                    field.merge.e.c + 1
                );
            }
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

    private applyBorders(worksheet: ExcelJS.Worksheet, borderRanges?: IBorderRange[]) {
        if (!borderRanges?.length) return;

        borderRanges.forEach(range => {
            const { from, to, outerBorder, innerBorder } = range;
            
            // Convert 0-indexed to 1-indexed for ExcelJS
            const startRow = from.r + 1;
            const endRow = to.r + 1;
            const startCol = from.c + 1;
            const endCol = to.c + 1;

            // Iterate through the range and apply borders
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    const cell = worksheet.getCell(row, col);
                    const isTopEdge = row === startRow;
                    const isBottomEdge = row === endRow;
                    const isLeftEdge = col === startCol;
                    const isRightEdge = col === endCol;

                    // Build border object - outer borders on edges, inner borders inside
                    cell.border = {
                        top: isTopEdge && outerBorder ? outerBorder : innerBorder,
                        bottom: isBottomEdge && outerBorder ? outerBorder : innerBorder,
                        left: isLeftEdge && outerBorder ? outerBorder : innerBorder,
                        right: isRightEdge && outerBorder ? outerBorder : innerBorder,
                    };
                }
            }
        });
    }

    private addImages(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, images?: IImageField[]) {
        if (!images?.length) return;

        images.forEach(image => {
            try {
                // Extract base64 data, removing data URL prefix if present
                let base64Data = image.imageBase64Data;
                const dataUrlMatch = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
                
                let extension: SupportedImageExtension = 'png';
                if (dataUrlMatch) {
                    const detectedExt = dataUrlMatch[1].toLowerCase();
                    if (detectedExt === 'jpg') {
                        extension = 'jpeg';
                    } else if (detectedExt === 'jpeg' || detectedExt === 'png' || detectedExt === 'gif') {
                        extension = detectedExt;
                    }
                    base64Data = dataUrlMatch[2];
                } else if (image.ext) {
                    const ext = image.ext.toLowerCase();
                    if (ext === 'jpg') {
                        extension = 'jpeg';
                    } else if (ext === 'jpeg' || ext === 'png' || ext === 'gif') {
                        extension = ext;
                    }
                }

                // Add image to workbook
                const imageId = workbook.addImage({
                    base64: base64Data,
                    extension: extension,
                });

                // Add image to worksheet at specified position/range
                if (image.range) {
                    // Use range for precise positioning (0-indexed to 0-indexed, ExcelJS uses 0-based)
                    worksheet.addImage(imageId, image.range);
                } else {
                    // Use position with default size
                    worksheet.addImage(imageId, image.position || {
                        tl: { col: 0, row: 0 },
                        ext: { width: 100, height: 100 }
                    });
                }
            } catch (error) {
                console.error('Error adding image to Excel:', error);
            }
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

export class GenericDataToExcelReportGenerator<T = any> extends DataToExcelReportGenerator<T> { }