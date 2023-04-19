import { IFormatter, IHeader } from "./types";
import TableRenderer from "./tableRenderer.component";
import { CommonFileFormat, CommonFileResponse } from "../report/types";
import { generateCommonFileResponse } from "../report/report.util";
import { BaseReportGenerator, DataToExcelReportGenerator, ReactToPdfReportGenerator } from "../report/report.generators";

export async function getExportedFile<T>(format: CommonFileFormat, name: string, data: T[], headers: IHeader[]): Promise<CommonFileResponse> {
    const headerRow = getHeaderNames(headers);
    const formatters = getHeaderFormatters(headers)
    const formattedData = data.map(row => formatters.map(func => func(row)));
    const generator = await getGenerator(format, name);

    return generateCommonFileResponse(generator, { headerRow, formattedData }, null);
};

async function getGenerator<T>(format: CommonFileFormat, name: string): Promise<BaseReportGenerator> {
    switch (format) {
        case CommonFileFormat.Excel: {
            return new DataToExcelReportGenerator(name);
        }
        case CommonFileFormat.Pdf: {
            const getReportData = async ({ headerRow, formattedData }) => ({ headers: headerRow, rows: formattedData });
            return new ReactToPdfReportGenerator(name, getReportData, TableRenderer);
        }
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
