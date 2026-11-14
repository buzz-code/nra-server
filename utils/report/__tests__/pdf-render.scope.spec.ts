import { BulkToPdfReportGenerator } from '../bulk-to-pdf.generator';
import { MarkupToPdfReportGenerator } from '../markup-to-pdf.generator';
import * as puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

jest.mock('puppeteer');

describe('BulkToPdfReportGenerator render scope', () => {
  class TestMarkupToPdfGenerator extends MarkupToPdfReportGenerator {
    async getFileBuffer(data: any): Promise<Buffer> {
      return this.convertMarkupToPdf('<div>row</div>');
    }
  }

  let mockBrowser: jest.Mocked<puppeteer.Browser>;
  let mockPage: jest.Mocked<puppeteer.Page>;
  let onePagePdfBuffer: Buffer;

  beforeEach(async () => {
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

    const onePagePdfDoc = await PDFDocument.create();
    onePagePdfDoc.addPage();
    onePagePdfBuffer = Buffer.from(await onePagePdfDoc.save());
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.PDF_MAX_CONCURRENT_BROWSERS;
    delete process.env.PDF_QUEUE_WAIT_MS;
    jest.clearAllMocks();
  });

  it('should launch exactly one browser for a 3 row report and close it once', async () => {
    mockPage.pdf.mockResolvedValue(onePagePdfBuffer);
    const bulkGenerator = new BulkToPdfReportGenerator(new TestMarkupToPdfGenerator(() => 'test'));

    const result = await bulkGenerator.getFileBuffer([1, 2, 3]);

    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    expect(puppeteer.launch).toHaveBeenCalledWith({
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
    });
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(3);
    expect(mockPage.close).toHaveBeenCalledTimes(3);
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    expect((await PDFDocument.load(result)).getPageCount()).toBe(3);
  });

  it('should close the shared browser once when a row fails', async () => {
    mockPage.pdf
      .mockResolvedValueOnce(onePagePdfBuffer)
      .mockRejectedValueOnce(new Error('row 2 pdf generation error'));
    const bulkGenerator = new BulkToPdfReportGenerator(new TestMarkupToPdfGenerator(() => 'test'));

    await expect(bulkGenerator.getFileBuffer([1, 2, 3])).rejects.toThrow('row 2 pdf generation error');

    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    expect(mockPage.close).toHaveBeenCalledTimes(2);
    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('should relaunch the shared browser at most once for a transient failure and continue remaining rows', async () => {
    const transientError = new Error(
      'Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.',
    );
    mockPage.pdf
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue(onePagePdfBuffer);
    const bulkGenerator = new BulkToPdfReportGenerator(new TestMarkupToPdfGenerator(() => 'test'));

    const result = await bulkGenerator.getFileBuffer([1, 2, 3]);

    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(4);
    expect(await PDFDocument.load(result)).not.toBeNull();
    expect((await PDFDocument.load(result)).getPageCount()).toBe(3);
  });

  it('should not leak a render slot when the report relaunches its browser', async () => {
    process.env.PDF_MAX_CONCURRENT_BROWSERS = '1';
    process.env.PDF_QUEUE_WAIT_MS = '1000';
    jest.useFakeTimers();

    const transientError = new Error(
      'Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.',
    );
    mockPage.pdf
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue(onePagePdfBuffer);
    const bulkGenerator = new BulkToPdfReportGenerator(new TestMarkupToPdfGenerator(() => 'test'));

    await bulkGenerator.getFileBuffer([1, 2, 3]);

    expect(puppeteer.launch).toHaveBeenCalledTimes(2); // shared browser relaunched once

    // With a cap of 1, a leaked slot would make this conversion wait in the
    // queue and reject instead of rendering immediately.
    const next = new TestMarkupToPdfGenerator(() => 'test').convertMarkupToPdf('<div>next</div>');
    await expect(next).resolves.toEqual(onePagePdfBuffer);
    expect(puppeteer.launch).toHaveBeenCalledTimes(3);
  });
});

describe('MarkupToPdfReportGenerator outside a scope', () => {
  // Sanity check: without a bulk report around it, every conversion still owns
  // its own browser.
  class TestMarkupToPdfGenerator extends MarkupToPdfReportGenerator {
    async getFileBuffer(data: any): Promise<Buffer> {
      return this.convertMarkupToPdf('<div>row</div>');
    }
  }

  let mockBrowser: jest.Mocked<puppeteer.Browser>;
  let mockPage: jest.Mocked<puppeteer.Page>;

  beforeEach(() => {
    mockPage = {
      setContent: jest.fn(),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf content')),
      on: jest.fn(),
      setRequestInterception: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    } as any as jest.Mocked<puppeteer.Page>;

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    } as any as jest.Mocked<puppeteer.Browser>;

    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should launch and close a browser per standalone conversion', async () => {
    const generator = new TestMarkupToPdfGenerator(() => 'test');

    await generator.convertMarkupToPdf('<div>a</div>');
    await generator.convertMarkupToPdf('<div>b</div>');

    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    expect(mockBrowser.close).toHaveBeenCalledTimes(2);
  });
});