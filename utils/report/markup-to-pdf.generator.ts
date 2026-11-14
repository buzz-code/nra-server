import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { BaseReportGenerator } from './report.generators';
import { CommonFileFormat } from './types';
import {
  acquireBrowserSlot,
  PUPPETEER_LAUNCH_ARGS,
  getPdfRenderBudgetMs,
  getPdfRenderScope,
  PdfPrintTimeoutError,
  releaseBrowserSlot,
} from './pdf-render.queue';

// Browser processes can die mid-render under load (e.g. killed by the OOM killer
// while several reports render at once), surfacing as protocol errors like
// "Session closed. Most likely the page has been closed.". Those failures are
// transient and are worth one retry with a fresh browser.
function isTransientPuppeteerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const transientSignatures = ['session closed', 'target closed', 'has been closed', 'page crash', 'target crash'];
  return transientSignatures.some((signature) => message.toLowerCase().includes(signature));
}

// Report markup embeds external stylesheet links (the Google Fonts links from
// getFontLinks()). When the host's network access hangs, those requests never
// settle: the networkidle0 wait times out, but the stuck requests keep the
// renderer busy and Page.printToPDF then stalls until its own timeout kills the
// request with a 500. The fallback render therefore aborts every http(s)
// request up-front - fonts/images fall back to what is available locally, and
// printing can no longer wait on the network.
async function blockExternalRequests(page: Page): Promise<void> {
  page.on('request', (request) => {
    if (request.url().startsWith('http')) {
      request.abort().catch(() => undefined);
    } else {
      request.continue().catch(() => undefined);
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

    // One render budget per convertMarkupToPdf call: the queue wait of a
    // retry is capped by the remaining budget, never by a fresh full wait.
    const queueDeadline = Date.now() + getPdfRenderBudgetMs();

    try {
      return await this.renderPdfAttempt(markup, queueDeadline, false);
    } catch (e) {
      if (!isTransientPuppeteerError(e)) {
        throw e;
      }
      return await this.renderPdfAttempt(markup, queueDeadline, true);
    }
  }

  // One attempt: either render on the browser of the active report render
  // scope (one browser per bulk report), or on a browser of this conversion's
  // own, launched inside a globally capped render-queue slot.
  private async renderPdfAttempt(markup: string, queueDeadline: number, isRetry: boolean): Promise<Buffer> {
    const scope = getPdfRenderScope();
    if (scope) {
      // Inside a render scope the report owns one browser: this conversion
      // only opens its page on it and must not close the browser. A retry
      // relaunches the shared browser at most once (restartBrowser).
      const browser = isRetry ? await scope.restartBrowser(queueDeadline) : await scope.getBrowser(queueDeadline);
      return this.renderPdfOnBrowser(browser, markup);
    }

    await acquireBrowserSlot(queueDeadline);
    let browser: Browser | undefined;
    try {
      browser = await puppeteer.launch({ args: PUPPETEER_LAUNCH_ARGS });
      return await this.renderPdfOnBrowser(browser, markup);
    } finally {
      // The browser may already be dead (crashed / OOM-killed), in which case
      // close() itself can reject - don't let that mask the real result.
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
      releaseBrowserSlot();
    }
  }

  private async renderPdfOnBrowser(browser: Browser, markup: string): Promise<Buffer> {
    const page = await browser.newPage();

    try {
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

      const printTimeoutMs = getPdfPrintTimeoutMs();
      try {
        return await page.pdf({
          format: 'A4',
          printBackground: true,
          timeout: printTimeoutMs,
        });
      } catch (e) {
        // puppeteer: "waiting for Page.printToPDF failed: timeout 30000ms exceeded"
        if (e instanceof Error && (e.name === 'TimeoutError' || /printToPDF.*timeout/i.test(e.message))) {
          throw new PdfPrintTimeoutError(printTimeoutMs, { cause: e });
        }
        throw e;
      }
    } finally {
      // Rows of a shared scope browser take their page with them, so a
      // many-row report can't pile up open pages; standalone browsers would
      // close it together with the browser anyway.
      try {
        await page.close();
      } catch {}
    }
  }
}

export class SimpleMarkupToPdfReportGenerator extends MarkupToPdfReportGenerator {
  constructor(getReportName: (data: any) => string, private markup: string) {
    super(getReportName);
  }

  async getFileBuffer(data: any): Promise<Buffer> {
    return this.convertMarkupToPdf(this.markup);
  }
}
