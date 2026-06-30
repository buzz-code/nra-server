import { BaseReportGenerator } from "./report.generators";
import { CommonFileFormat } from "./types";

export class BufferToMp3ReportGenerator extends BaseReportGenerator<Buffer, Buffer> {
    fileFormat: CommonFileFormat = CommonFileFormat.Mp3;

    async getFileBuffer(data: Buffer): Promise<Buffer> {
        return data;
    }
}
