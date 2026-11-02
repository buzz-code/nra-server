import { DataSource } from "typeorm";
import { PDFDocument } from 'pdf-lib';
import { BaseReportGenerator } from "./report.generators";
import { CommonFileFormat } from "./types";
import { runPdfRenderScope } from "./pdf-render.queue";

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
        // One render scope for the whole report: rows render on pages of ONE
        // shared browser (opened by the first PDF conversion in the scope) and
        // it is closed once when the scope ends - success or throw.
        return runPdfRenderScope(async () => {
            const pdfDoc = await PDFDocument.create()
            for (const item of data) {
                const ItemPdfBytes = await this.generator.getFileBuffer(item);
                const itemPdfDoc = await PDFDocument.load(ItemPdfBytes);
                const itemPdfPages = await pdfDoc.copyPages(itemPdfDoc, itemPdfDoc.getPageIndices());
                itemPdfPages.forEach((page) => pdfDoc.addPage(page));
            }
            const pdfBytes = await pdfDoc.save()

            return Buffer.from(pdfBytes);
        });
    }
}
