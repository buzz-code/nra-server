import { IFormatter, IHeader } from "./types";
import TableRenderer from "./tableRenderer.component";
import { CommonFileFormat, CommonFileResponse } from "../report/types";
import { getFileBuffer, getCommonFileResponse } from "../report/report.util";
import { DataToExcelReportGenerator, IDataToExcelReportGenerator, ReactToPdfReportGenerator } from "../report/report.generators";

export async function getExportedFile<T>(format: CommonFileFormat, name: string, data: T[], headers: IHeader[]): Promise<CommonFileResponse> {
    const fileBuffer = await getExportFileBuffer(name, format, data, headers);
    return getCommonFileResponse(fileBuffer, format, name);
};

async function getExportFileBuffer<T>(name: string, format: CommonFileFormat, data: T[], headers: IHeader[]): Promise<Buffer> {
    const headerRow = getHeaderNames(headers);
    const formatters = getHeaderFormatters(headers)
    const formattedData = data.map(row => formatters.map(func => func(row)));

    switch (format) {
        case CommonFileFormat.Excel:
            return getExcelFile(name, headerRow, formattedData);
        case CommonFileFormat.Pdf:
            return getPdfFile(name, headerRow, formattedData);
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

async function getExcelFile<T>(name: string, headerRow: string[], formattedData: string[][]): Promise<Buffer> {
    const generator = new DataToExcelReportGenerator(name, null);
    const data: IDataToExcelReportGenerator = { headerRow, formattedData };
    return getFileBuffer(generator, data);
}

async function getPdfFile<T>(name: string, headerRow: string[], formattedData: string[][]): Promise<Buffer> {
    const generator = new ReactToPdfReportGenerator(name, null, TableRenderer);
    const data = { headers: headerRow, rows: formattedData };
    return getFileBuffer(generator, data);
}
