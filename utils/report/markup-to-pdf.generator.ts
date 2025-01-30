import puppeteer from 'puppeteer';
import { BaseReportGenerator } from './report.generators';
import { CommonFileFormat } from './types';

export abstract class MarkupToPdfReportGenerator<T = any, U = any> extends BaseReportGenerator<T, U> {
    fileFormat: CommonFileFormat = CommonFileFormat.Pdf;

    async convertMarkupToPdf(markup: string): Promise<Buffer> {
        if (this.fileFormat === CommonFileFormat.Html) {
            return Buffer.from(markup);
        }

        let browser;
        try {
            browser = await puppeteer.launch({
                args: [
                    "--disable-dev-shm-usage",
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });
            const page = await browser.newPage();

            await page.setContent(markup);

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true
            });
            await browser.close();

            return pdf;
        } catch (e) {
            browser && await browser.close();
            throw e;
        }
    }
}

export class SimpleMarkupToPdfReportGenerator extends MarkupToPdfReportGenerator {
    constructor(
        getReportName: (data: any) => string,
        private markup: string,
    ) {
        super(getReportName);
    }

    async getFileBuffer(data: any): Promise<Buffer> {
        return this.convertMarkupToPdf(this.markup);
    }
}