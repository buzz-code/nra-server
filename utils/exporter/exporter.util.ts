import { IFormatter, IHeader } from "./types";
import * as XLSX from 'xlsx-color';
import TableRenderer from "./tableRenderer.component";
import { CommonFileFormat, CommonFileResponse } from "../report/types";
import { getFileBuffer, getCommonFileResponse } from "../report/report.util";

export async function getExportedFile<T>(format: CommonFileFormat, name: string, data: T[], headers: IHeader[]): Promise<CommonFileResponse> {
    const fileBuffer = await getExportFileBuffer(format, data, headers);
    return getCommonFileResponse(fileBuffer, format, name);
};

async function getExportFileBuffer<T>(format: CommonFileFormat, data: T[], headers: IHeader[]): Promise<Buffer> {
    const headerRow = getHeaderNames(headers);
    const formatters = getHeaderFormatters(headers)
    const formattedData = data.map(row => formatters.map(func => func(row)));

    switch (format) {
        case CommonFileFormat.Excel:
            return getExcelFile(headerRow, formattedData);
        case CommonFileFormat.Pdf:
            return getPdfFile(headerRow, formattedData);
        default:
            throw new Error('unknown format ' + format);
    }
}

function getHeaderNames(headers: IHeader[]): string[] {
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
        if (val instanceof Date) {
            return Intl.DateTimeFormat('he', { dateStyle: 'short' }).format(val);
        }
        return val?.toString();
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

async function getExcelFile<T>(headerRow: string[], formattedData: string[][]): Promise<Buffer> {
    const ws = XLSX.utils.aoa_to_sheet([headerRow]);
    XLSX.utils.sheet_add_aoa(ws, formattedData, { origin: -1 });

    for (let index = 0; index < headerRow.length; index++) {
        var cell_ref = XLSX.utils.encode_cell({ c: index, r: 0 });
        ws[cell_ref].s = {
            font: {
                bold: true
            },
            fill: {
                fgColor: { rgb: "f2f2f2" }
            }
        }
    }

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

async function getPdfFile<T>(headerRow: string[], formattedData: string[][]): Promise<Buffer> {
    return getFileBuffer(CommonFileFormat.Pdf, {
        component: TableRenderer,
        data: { headers: headerRow, rows: formattedData }
    })
}
