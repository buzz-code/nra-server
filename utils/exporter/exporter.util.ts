import { IFormatter, IHeader } from "./types";
import TableRenderer from "./tableRenderer.component";
import { CommonFileFormat, CommonFileResponse } from "../report/types";
import { generateCommonFileResponse } from "../report/report.util";
import { BaseReportGenerator } from "../report/report.generators";
import { ParamsToJsonReportGenerator } from "../report/params-to-json.generator";
import { DataToExcelReportGenerator } from "../report/data-to-excel.generator";
import { ReactToPdfReportGenerator } from "../report/react-to-pdf.generator";
import { BadRequestException } from "@nestjs/common";
import { getValueByPath } from "../formatting/formatter.util";

export async function getExportedFile<T>(format: CommonFileFormat, name: string, data: T[], headers: IHeader[]): Promise<CommonFileResponse> {
    const headerRow = getHeaderNames(headers);
    const formatters = getHeaderFormatters(headers)
    const formattedData = data.map(row => formatters.map(func => func(row)));
    const generator = await getGenerator(format, name);

    return generateCommonFileResponse(generator, { headerRow, formattedData }, null);
};

async function getGenerator<T>(format: CommonFileFormat, name: string): Promise<BaseReportGenerator> {
    const getReportName = () => name;
    switch (format) {
        case CommonFileFormat.Excel: {
            return new DataToExcelReportGenerator(getReportName);
        }
        case CommonFileFormat.Pdf: {
            const getReportData = async ({ headerRow, formattedData }) => ({ headers: headerRow, rows: formattedData });
            return new ReactToPdfReportGenerator(getReportName, getReportData, TableRenderer);
        }
        case CommonFileFormat.Json: {
            return new ParamsToJsonReportGenerator(getReportName);
        }
        default:
            throw new BadRequestException('unknown format ' + format);
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
    return (row) => {
        const val = getValueByPath(row, key);
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
