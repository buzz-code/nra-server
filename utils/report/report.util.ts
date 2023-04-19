import { CommonFileFormat } from "./types";
import { BaseReportGenerator } from "./report.generators";
import { DataSource } from "typeorm";

export async function generateCommonFileResponse<T = any>(generator: BaseReportGenerator, params: T, dataSource: DataSource) {
    const data = await generator.getReportData(params, dataSource);
    const buffer = await generator.getFileBuffer(data);
    return getCommonFileResponse(buffer, generator.fileFormat, generator.reportName);
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

function getFileType(format: CommonFileFormat): string {
    switch (format) {
        case CommonFileFormat.Excel:
            return 'application/vnd.ms-excel';
        case CommonFileFormat.Pdf:
            return 'application/pdf';
        case CommonFileFormat.Json:
            return 'application/json';
    }
}

function getFileDisposition(format: CommonFileFormat, name: string): string {
    const timestamp = new Date().toISOString();
    switch (format) {
        case CommonFileFormat.Excel:
            return `attachment; filename="${name}-${timestamp}.xlsx"`
        case CommonFileFormat.Pdf:
            return `attachment; filename="${name}-${timestamp}.pdf"`
        case CommonFileFormat.Json:
            return `attachment; filename="${name}-${timestamp}.json"`
    }
}

export function getFileBuffer(generator: BaseReportGenerator, data: any): Promise<Buffer> {
    return generator.getFileBuffer(data);
}
