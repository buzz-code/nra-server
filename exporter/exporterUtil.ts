import { StreamableFile } from "@nestjs/common";
import { ExportFormats, IFormatter, IHeader } from "./types";
import * as XLSX from 'xlsx';

export async function getExportedFile<T>(format: ExportFormats, name: string, data: T[], headers: IHeader[]): Promise<StreamableFile> {
    const fileBuffer = getFileBuffer(format, data, headers);
    const type = getFileType(format);
    const disposition = getFileDisposition(format, name);
    return new StreamableFile(fileBuffer, { type, disposition })
};

function getFileBuffer<T>(format: ExportFormats, data: T[], headers: IHeader[]): Buffer {
    switch (format) {
        case ExportFormats.Excel:
            return getExcelFile(data, headers);
        case ExportFormats.Pdf:
            return getPdfFile(data, headers);
        default:
            throw new Error('unknown format ' + format);
    }
}

function getHeaderNames(headers: IHeader[]): String[] {
    return headers.map(item => {
        if (typeof (item) === 'string') {
            return item;
        }
        return item.label;
    })
}

function getSimpleFormatter(key: string) {
    const parts = key?.split('.');
    return (row) => {
        if (!key) {
            return null;
        }
        let val = row;
        for (const part of parts) {
            val = val?.[part];
        }
        return val;
    }
}

function getHeaderFormatters(headers: IHeader[]): IFormatter[] {
    return headers.map(item => {
        if (typeof (item) === 'string') {
            return getSimpleFormatter(item);
        }
        if (typeof (item.value) === 'string') {
            return getSimpleFormatter(item.value);
        }
        return item.value;
    })
}

function getExcelFile<T>(data: T[], headers: IHeader[]): Buffer {
    const headerRow = getHeaderNames(headers);
    const formatters = getHeaderFormatters(headers)
    const formattedData = data.map(row => formatters.map(func => func(row)));

    const ws = XLSX.utils.aoa_to_sheet([headerRow]);
    XLSX.utils.sheet_add_aoa(ws, formattedData, { origin: -1 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'גליון1');

    wb.Workbook ??= {}
    wb.Workbook.Views ??= [{}]
    wb.Workbook.Views.forEach((view) => {
      view.RTL = true;
    })
  
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return buffer;
}

function getPdfFile<T>(data: T[], headers: IHeader[]): Buffer {
    // todo: implement pdf file
    return null;
}

function getFileType(format: ExportFormats): string {
    switch (format) {
        case ExportFormats.Excel:
            return 'application/vnd.ms-excel';
        case ExportFormats.Pdf:
            return 'application/pdf';
    }
}

function getFileDisposition(format: ExportFormats, name: string): string {
    const timestamp = new Date().toISOString();
    switch (format) {
        case ExportFormats.Excel:
            return `attachment; filename="${name}-${timestamp}.xlsx"`
        case ExportFormats.Pdf:
            return `attachment; filename="${name}-${timestamp}.pdf"`
    }
}
