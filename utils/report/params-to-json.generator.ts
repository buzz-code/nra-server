import { BaseReportGenerator } from "./report.generators";
import { CommonFileFormat } from "./types";

export class ParamsToJsonReportGenerator extends BaseReportGenerator {
    fileFormat: CommonFileFormat = CommonFileFormat.Json;

    async getFileBuffer(data: any): Promise<Buffer> {
        return Buffer.from(JSON.stringify(data, null, 2));
    }
}
