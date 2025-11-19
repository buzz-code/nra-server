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

            // Log any console errors from the page
            page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
            page.on('pageerror', (error) => console.log('PAGE ERROR:', error.message));

            await page.setContent(markup, { waitUntil: 'networkidle0' });

            // Wait for all images (including base64 data URIs) to load
            await page.evaluate(() => {
              return Promise.all(
                Array.from(document.images).map((img) => {
                  if (img.complete && img.naturalWidth > 0) {
                    return Promise.resolve();
                  }
                  return new Promise((resolve) => {
                    img.onload = img.onerror = resolve;
                  });
                }),
              );
            });

            // Small delay to ensure rendering is complete
            await page.waitForTimeout(500);

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: false,
                displayHeaderFooter: false,
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