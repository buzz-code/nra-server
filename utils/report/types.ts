import { BaseReportGenerator } from "./report.generators";

export interface CommonFileResponse {
    data: string;
    type: string;
    disposition: string;
}

export enum CommonFileFormat {
    Excel,
    Pdf,
    Json,
    Zip,
    Html,
};

export interface CommonReportData<T = any> {
    generator: BaseReportGenerator;
    params: T;
}

export const exportFormatDict = {
    excel: CommonFileFormat.Excel,
    pdf: CommonFileFormat.Pdf,
    json: CommonFileFormat.Json,
};
