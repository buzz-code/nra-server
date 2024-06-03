import { CommonFileFormat } from "./types";
import { BaseReportGenerator } from "./report.generators";
import { DataSource } from "typeorm";

export async function generateCommonFileResponse<T = any>(generator: BaseReportGenerator, params: T, dataSource: DataSource) {
    const data = await generator.getReportData(params, dataSource);
    const buffer = await generator.getFileBuffer(data);
    const filename = generator.getReportName(data);
    return getCommonFileResponse(buffer, generator.fileFormat, filename);
}

function getCommonFileResponse(buffer: Buffer, format: CommonFileFormat, name: string) {
    const type = getFileType(format);
    const disposition = getFileDisposition(format, name);
    return {
        data: buffer.toString('base64'),
        type,
        disposition,
    }
}

export function getFileType(format: CommonFileFormat): string {
    switch (format) {
        case CommonFileFormat.Excel:
            return 'application/vnd.ms-excel';
        case CommonFileFormat.Pdf:
            return 'application/pdf';
        case CommonFileFormat.Json:
            return 'application/json';
        case CommonFileFormat.Zip:
            return 'application/zip';
        case CommonFileFormat.Html:
            return 'text/html';
    }
}

function getFileDisposition(format: CommonFileFormat, name: string): string {
    const timestamp = new Date().toISOString();
    const extension = getFileExtension(format);
    return `attachment; filename="${name}-${timestamp}.${extension}"`;
}

export function getFileExtension(format: CommonFileFormat) {
    switch (format) {
        case CommonFileFormat.Excel:
            return 'xlsx';
        case CommonFileFormat.Pdf:
            return 'pdf';
        case CommonFileFormat.Json:
            return 'json';
        case CommonFileFormat.Zip:
            return 'zip';
        case CommonFileFormat.Html:
            return 'html';
    }

}

export function getFileBuffer(generator: BaseReportGenerator, data: any): Promise<Buffer> {
    return generator.getFileBuffer(data);
}
