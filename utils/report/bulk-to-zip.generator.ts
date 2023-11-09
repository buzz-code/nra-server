import { DataSource } from "typeorm";
import * as JSZip from 'jszip';
import { BaseReportGenerator, IGetReportDataFunction } from "./report.generators";
import { CommonFileFormat } from "./types";
import { getFileExtension } from "./report.util";

export class BulkToZipReportGenerator extends BaseReportGenerator {
    fileFormat: CommonFileFormat = CommonFileFormat.Zip;
    generator: BaseReportGenerator;

    constructor(
        getReportName: (data: any) => string,
        generator: BaseReportGenerator,
        getReportData?: IGetReportDataFunction<any, any>,
    ) {
        super(getReportName, null);
        this.generator = generator;
        if (getReportData) {
            this.getReportData = getReportData;
        } else {
            this.getReportData = (arr: any[], dataSource: DataSource) =>
                Promise.all(
                    arr.map(item => this.generator.getReportData(item, dataSource))
                );
        }
    }

    async getFileBuffer(data: any[]): Promise<Buffer> {
        if (data.length === 1 && this.generator.fileFormat === CommonFileFormat.Zip) {
            return this.generator.getFileBuffer(data[0]);
        }

        var zip = new JSZip();
        const extension = getFileExtension(this.generator.fileFormat);
        let counter = 1;
        for (const item of data) {
            const buffer = await this.generator.getFileBuffer(item);
            const reportName = this.generator.getReportName(item);
            const filename = `${counter}_${reportName}.${extension}`;
            zip.file(filename, buffer);
            counter++;
        }
        return zip.generateAsync({ type: "nodebuffer" });
    }
}
