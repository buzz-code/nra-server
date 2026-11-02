import { MarkupToPdfReportGenerator } from '../markup-to-pdf.generator';
import { PdfRenderQueueTimeoutError } from '../pdf-render.queue';
import * as puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

jest.mock('puppeteer');

describe('PDF render queue', () => {
  class TestMarkupToPdfGenerator extends MarkupToPdfReportGenerator {
    async getFileBuffer(data: any): Promise<Buffer> {
      return this.convertMarkupToPdf(data);
    }
  }

  let generator: TestMarkupToPdfGenerator;
  let mockBrowser: jest.Mocked<puppeteer.Browser>;
  let mockPage: jest.Mocked<puppeteer.Page>;
  let onePagePdfBuffer: Buffer;
  let pdfResolvers: Array<(pdf: Buffer) => void>;
  let deferredPdf: () => Promise<Buffer>;

  beforeEach(async () => {
    pdfResolvers = [];
    deferredPdf = () =>
      new Promise<Buffer>((resolve) => {
        pdfResolvers.push(resolve);
      });

    mockPage = {
      setContent: jest.fn(),
      pdf: jest.fn(),
      on: jest.fn(),
      setRequestInterception: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    } as any as jest.Mocked<puppeteer.Page>;

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    } as any as jest.Mocked<puppeteer.Browser>;

    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);

    generator = new TestMarkupToPdfGenerator(() => 'test');

    const onePagePdfDoc = await PDFDocument.create();
    onePagePdfDoc.addPage();
    onePagePdfBuffer = Buffer.from(await onePagePdfDoc.save());
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.PDF_MAX_CONCURRENT_BROWSERS;
    delete process.env.PDF_QUEUE_WAIT_MS;
    delete process.env.PDF_RENDER_BUDGET_MS;
    jest.clearAllMocks();
  });

  it('should queue a conversion above the cap and reject it with PdfRenderQueueTimeoutError after the configured wait', async () => {
    process.env.PDF_MAX_CONCURRENT_BROWSERS = '2';
    process.env.PDF_QUEUE_WAIT_MS = '20000';
    jest.useFakeTimers();

    mockPage.pdf.mockImplementation(deferredPdf);
    const first = generator.convertMarkupToPdf('<div>first</div>');
    const second = generator.convertMarkupToPdf('<div>second</div>');

    const third = generator.convertMarkupToPdf('<div>third</div>');

    let rejection: any;
    third.then(
      () => {
        rejection = new Error('third conversion should not resolve');
      },
      (e) => {
        rejection = e;
      },
    );
    await jest.advanceTimersByTimeAsync(20000);

    expect(rejection).toBeInstanceOf(PdfRenderQueueTimeoutError);
    expect(rejection.message).toBe('PDF render queue wait exceeded 20000ms (max 2 concurrent browsers)');
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);

    // No slot leak: once the holding conversions finish, the next conversion
    // goes through instead of waiting forever.
    pdfResolvers.forEach((resolve) => resolve(onePagePdfBuffer));
    await Promise.all([first, second]);

    const fourth = generator.convertMarkupToPdf('<div>fourth</div>');
    while (pdfResolvers.length < 3) {
      await Promise.resolve();
    }
    pdfResolvers[pdfResolvers.length - 1](onePagePdfBuffer);
    await expect(fourth).resolves.toEqual(onePagePdfBuffer);
    expect(puppeteer.launch).toHaveBeenCalledTimes(3);
  });

  it('should cap the retry queue wait by the remaining render budget', async () => {
    process.env.PDF_MAX_CONCURRENT_BROWSERS = '2';
    process.env.PDF_QUEUE_WAIT_MS = '30000';
    process.env.PDF_RENDER_BUDGET_MS = '20000';
    jest.useFakeTimers();

    const transientError = new Error(
      'Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.',
    );

    // Deterministic by markup: the conversion under test burns 5000ms of its
    // budget with a stuck setContent; the two holder conversions render
    // instantly and hold their slots with deferred pdf promises.
    mockPage.setContent.mockImplementation((markup: string) => {
      if (String(markup).includes('burn')) {
        return new Promise((resolve) => setTimeout(resolve, 5000));
      }
      return Promise.resolve();
    });
    mockPage.pdf
      .mockImplementationOnce(deferredPdf) // holder conversion holds its slot
      .mockImplementationOnce(() => Promise.reject(transientError)) // first (burning) attempt of `conversion`
      .mockImplementation(deferredPdf); // all other conversions (incl. the second holder)

    const holder = generator.convertMarkupToPdf('<div>holder</div>');
    const conversion = generator.convertMarkupToPdf('<div>burn</div>');
    const secondHolder = generator.convertMarkupToPdf('<div>second holder</div>');

    let rejection: any;
    conversion.then(
      () => {
        rejection = new Error('conversion should not resolve');
      },
      (e) => {
        rejection = e;
      },
    );

    // 5000ms burnt + 14999ms of the retry's queue wait: still inside budget.
    await jest.advanceTimersByTimeAsync(5000 + 14999);
    expect(rejection).toBeUndefined();

    // The retry's wait runs out at exactly the remaining budget (20000 - 5000).
    await jest.advanceTimersByTimeAsync(1000);
    expect(rejection).toBeInstanceOf(PdfRenderQueueTimeoutError);
    expect(rejection.message).toBe('PDF render queue wait exceeded 15000ms (max 2 concurrent browsers)');
    expect(puppeteer.launch).toHaveBeenCalledTimes(3);

    // No slot leak after the queue timeout: settling the holders frees the
    // slots and the next conversion still gets through.
    pdfResolvers.forEach((resolve) => resolve(onePagePdfBuffer));
    await Promise.all([holder, secondHolder]);

    const fourth = generator.convertMarkupToPdf('<div>after timeout</div>');
    while (pdfResolvers.length < 3) {
      await Promise.resolve();
    }
    pdfResolvers[pdfResolvers.length - 1](onePagePdfBuffer);
    await expect(fourth).resolves.toEqual(onePagePdfBuffer);
    expect(puppeteer.launch).toHaveBeenCalledTimes(4);
  });

  it('should clean up and let the next conversion through when everything settles', async () => {
    // (tail of the two tests above; this one checks the simple failure path)
    mockPage.pdf.mockRejectedValueOnce(new Error('pdf generation error')).mockResolvedValue(onePagePdfBuffer);

    await expect(generator.convertMarkupToPdf('<div>a</div>')).rejects.toThrow('pdf generation error');
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);

    const result = await generator.convertMarkupToPdf('<div>b</div>');

    expect(result).toEqual(onePagePdfBuffer);
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    expect(mockBrowser.close).toHaveBeenCalledTimes(2);
  });
});