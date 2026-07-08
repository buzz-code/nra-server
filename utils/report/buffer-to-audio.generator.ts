import { BaseReportGenerator } from "./report.generators";
import { CommonFileFormat } from "./types";

export class BufferToAudioReportGenerator extends BaseReportGenerator<Buffer, Buffer> {
    constructor(getReportName: (data: Buffer) => string, public fileFormat: CommonFileFormat) {
        super(getReportName);
    }

    async getFileBuffer(data: Buffer): Promise<Buffer> {
        return data;
    }
}
