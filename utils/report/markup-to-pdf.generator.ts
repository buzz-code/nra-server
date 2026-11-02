import puppeteer from 'puppeteer';
import type { Page } from 'puppeteer';
import { BaseReportGenerator } from './report.generators';
import { CommonFileFormat } from './types';

const PUPPETEER_LAUNCH_ARGS = [
    "--disable-dev-shm-usage",
    '--no-sandbox',
    '--disable-setuid-sandbox'
];

// Browser processes can die mid-render under load (e.g. killed by the OOM killer
// while several reports render at once), surfacing as protocol errors like
// "Session closed. Most likely the page has been closed.". Those failures are
// transient and are worth one retry with a fresh browser.
function isTransientPuppeteerError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const transientSignatures = [
        'session closed',
        'target closed',
        'has been closed',
        'page crash',
        'target crash',
    ];
    return transientSignatures.some(signature => message.toLowerCase().includes(signature));
}

// Report markup embeds external stylesheet links (the Google Fonts links from
// getFontLinks()). When the host's network access hangs, those requests never
// settle: the networkidle0 wait times out, but the stuck requests keep the
// renderer busy and Page.printToPDF then stalls until its own timeout kills the
// request with a 500. The fallback render therefore aborts every http(s)
// request up-front - fonts/images fall back to what is available locally, and
// printing can no longer wait on the network.
async function blockExternalRequests(page: Page): Promise<void> {
    page.on('request', request => {
        if (request.url().startsWith('http')) {
            request.abort().catch(() => {});
        } else {
            request.continue().catch(() => {});
        }
    });
    await page.setRequestInterception(true);
}

// Page.printToPDF gets puppeteer's hardcoded 30s default; large reports on slow
// hosts can need more. PDF_PRINT_TIMEOUT_MS overrides it.
function getPdfPrintTimeoutMs(): number {
    const configured = Number(process.env.PDF_PRINT_TIMEOUT_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : 30000;
}

export abstract class MarkupToPdfReportGenerator<T = any, U = any> extends BaseReportGenerator<T, U> {
    fileFormat: CommonFileFormat = CommonFileFormat.Pdf;

    async convertMarkupToPdf(markup: string): Promise<Buffer> {
        if (this.fileFormat === CommonFileFormat.Html) {
            return Buffer.from(markup);
        }

        try {
            return await this.generatePdfInFreshBrowser(markup);
        } catch (e) {
            if (!isTransientPuppeteerError(e)) {
                throw e;
            }
            return await this.generatePdfInFreshBrowser(markup);
        }
    }

    private async generatePdfInFreshBrowser(markup: string): Promise<Buffer> {
        let browser;
        try {
            browser = await puppeteer.launch({ args: PUPPETEER_LAUNCH_ARGS });
            const page = await browser.newPage();

            try {
                await page.setContent(markup, { waitUntil: 'networkidle0', timeout: 10000 });
            } catch (e) {
                // A stray external reference in report markup shouldn't be able to
                // hang the whole request for the full default 30s - fall back to a
                // render that doesn't wait on network at all. Stuck requests would
                // still stall Page.printToPDF, so abort them via interception.
                await blockExternalRequests(page);
                await page.setContent(markup, { waitUntil: 'domcontentloaded' });
            }

            return await page.pdf({
                format: 'A4',
                printBackground: true,
                timeout: getPdfPrintTimeoutMs(),
            });
        } finally {
            // The browser may already be dead (crashed / OOM-killed), in which case
            // close() itself can reject - don't let that mask the real result.
            if (browser) {
                try {
                    await browser.close();
                } catch {}
            }
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