import { DataSource } from "typeorm";
import { PDFDocument } from 'pdf-lib';
import { BaseReportGenerator } from "./report.generators";
import { CommonFileFormat } from "./types";

export class BulkToPdfReportGenerator extends BaseReportGenerator {
    fileFormat: CommonFileFormat = CommonFileFormat.Pdf;
    generator: BaseReportGenerator;

    constructor(
        generator: BaseReportGenerator,
    ) {
        super(generator.getReportName, null);
        this.generator = generator;
        this.getReportData = (arr: any[], dataSource: DataSource) =>
            Promise.all(
                arr.map(item => this.generator.getReportData(item, dataSource))
            );
    }

    async getFileBuffer(data: any[]): Promise<Buffer> {
        const pdfDoc = await PDFDocument.create()
        for (const item of data) {
            const ItemPdfBytes = await this.generator.getFileBuffer(item);
            const itemPdfDoc = await PDFDocument.load(ItemPdfBytes);
            const itemPdfPages = await pdfDoc.copyPages(itemPdfDoc, itemPdfDoc.getPageIndices());
            itemPdfPages.forEach((page) => pdfDoc.addPage(page));
        }
        const pdfBytes = await pdfDoc.save()

        return Buffer.from(pdfBytes);
    }
}
