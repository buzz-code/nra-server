import { MarkupToPdfReportGenerator, SimpleMarkupToPdfReportGenerator } from '../markup-to-pdf.generator';
import { CommonFileFormat } from '../types';
import * as puppeteer from 'puppeteer';

jest.mock('puppeteer');

describe('MarkupToPdfReportGenerator', () => {
  // Create a concrete implementation for testing the abstract class
  class TestMarkupToPdfGenerator extends MarkupToPdfReportGenerator {
    async getFileBuffer(data: any): Promise<Buffer> {
      const markup = '<div>Test</div>';
      return this.convertMarkupToPdf(markup);
    }
  }

  let generator: TestMarkupToPdfGenerator;
  let mockBrowser: jest.Mocked<puppeteer.Browser>;
  let mockPage: jest.Mocked<puppeteer.Page>;

  beforeEach(() => {
    mockPage = {
      setContent: jest.fn(),
      pdf: jest.fn(),
      on: jest.fn(),
      setRequestInterception: jest.fn().mockResolvedValue(undefined),
    } as any as jest.Mocked<puppeteer.Page>;

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    } as any as jest.Mocked<puppeteer.Browser>;

    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);

    generator = new TestMarkupToPdfGenerator(() => 'test');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should set correct file format', () => {
    expect(generator.fileFormat).toBe(CommonFileFormat.Pdf);
  });

  describe('convertMarkupToPdf', () => {
    const markup = '<div>Test Content</div>';

    it('should return markup directly if file format is HTML', async () => {
      generator.fileFormat = CommonFileFormat.Html;
      const result = await generator.convertMarkupToPdf(markup);
      expect(result).toEqual(Buffer.from(markup));
    });

    it('should convert HTML to PDF using puppeteer', async () => {
      const pdfBuffer = Buffer.from('pdf content');
      mockPage.pdf.mockResolvedValue(pdfBuffer);

      const result = await generator.convertMarkupToPdf(markup);

      expect(puppeteer.launch).toHaveBeenCalledWith({
        args: [
          "--disable-dev-shm-usage",
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });
      expect(mockPage.setContent).toHaveBeenCalledWith(markup, expect.any(Object));
      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'A4',
        printBackground: true,
        timeout: 30000
      });
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(result).toEqual(pdfBuffer);
    });

    it('should handle puppeteer errors', async () => {
      const error = new Error('Puppeteer error');
      mockPage.pdf.mockRejectedValue(error);

      await expect(generator.convertMarkupToPdf(markup)).rejects.toThrow(error);
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should close browser even if PDF generation fails', async () => {
      const error = new Error('PDF generation error');
      mockPage.pdf.mockRejectedValue(error);

      try {
        await generator.convertMarkupToPdf(markup);
      } catch (e) {
        expect(mockBrowser.close).toHaveBeenCalled();
      }
    });

    it('should block external requests on the fallback render after a network-idle timeout', async () => {
      let requestHandler: (request: any) => void;
      mockPage.on.mockImplementation(((event: any, handler: any) => {
        if (event === 'request') requestHandler = handler;
      }) as any);
      mockPage.setContent
        .mockRejectedValueOnce(new Error('Navigation timeout of 10000 ms exceeded'))
        .mockResolvedValue(undefined);
      mockPage.pdf.mockResolvedValue(Buffer.from('pdf content'));

      await generator.convertMarkupToPdf(markup);

      expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
      expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);

      const externalRequest = { url: () => 'https://fonts.googleapis.com/css2?family=Roboto', abort: jest.fn().mockResolvedValue(undefined), continue: jest.fn() };
      requestHandler(externalRequest);
      expect(externalRequest.abort).toHaveBeenCalled();

      const localRequest = { url: () => 'data:image/png;base64,abc', abort: jest.fn(), continue: jest.fn().mockResolvedValue(undefined) };
      requestHandler(localRequest);
      expect(localRequest.continue).toHaveBeenCalled();
    });

    it('should honor PDF_PRINT_TIMEOUT_MS for the pdf print', async () => {
      process.env.PDF_PRINT_TIMEOUT_MS = '60000';
      mockPage.pdf.mockResolvedValue(Buffer.from('pdf content'));

      await generator.convertMarkupToPdf(markup);

      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'A4',
        printBackground: true,
        timeout: 60000
      });
      delete process.env.PDF_PRINT_TIMEOUT_MS;
    });

    it('should retry once with a fresh browser on transient session-closed errors', async () => {
      const pdfBuffer = Buffer.from('pdf content');
      const transientError = new Error(
        'Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.'
      );
      const deadBrowser = {
        newPage: jest.fn().mockRejectedValue(transientError),
        close: jest.fn(),
      };
      mockPage.pdf.mockResolvedValue(pdfBuffer);
      (puppeteer.launch as jest.Mock)
        .mockResolvedValueOnce(deadBrowser)
        .mockResolvedValue(mockBrowser);

      const result = await generator.convertMarkupToPdf(markup);

      expect(puppeteer.launch).toHaveBeenCalledTimes(2);
      expect(deadBrowser.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(result).toEqual(pdfBuffer);
    });

    it('should retry with a fresh browser when the page dies mid-setContent', async () => {
      const pdfBuffer = Buffer.from('pdf content');
      const transientError = new Error(
        'Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.'
      );
      mockPage.setContent
        .mockRejectedValueOnce(transientError) // first attempt, networkidle0
        .mockRejectedValueOnce(transientError) // first attempt, fallback
        .mockResolvedValue(undefined); // retried attempt
      mockPage.pdf.mockResolvedValue(pdfBuffer);

      const result = await generator.convertMarkupToPdf(markup);

      expect(puppeteer.launch).toHaveBeenCalledTimes(2);
      expect(mockPage.setContent).toHaveBeenCalledTimes(3);
      expect(result).toEqual(pdfBuffer);
    });

    it('should not retry on non-transient errors', async () => {
      mockPage.setContent.mockRejectedValue(new Error('Puppeteer error'));

      await expect(generator.convertMarkupToPdf(markup)).rejects.toThrow('Puppeteer error');
      expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    });

    it('should not let a failing browser.close mask the original error', async () => {
      const error = new Error('PDF generation error');
      mockPage.pdf.mockRejectedValue(error);
      mockBrowser.close.mockRejectedValue(new Error('Browser has been closed'));

      await expect(generator.convertMarkupToPdf(markup)).rejects.toThrow(error);
    });

    it('should return the pdf even if browser.close rejects', async () => {
      const pdfBuffer = Buffer.from('pdf content');
      mockPage.pdf.mockResolvedValue(pdfBuffer);
      mockBrowser.close.mockRejectedValue(new Error('Browser has been closed'));

      const result = await generator.convertMarkupToPdf(markup);

      expect(result).toEqual(pdfBuffer);
    });
  });
});

describe('SimpleMarkupToPdfReportGenerator', () => {
  let generator: SimpleMarkupToPdfReportGenerator;
  const getReportName = jest.fn();
  const markup = '<div>Test Content</div>';

  beforeEach(() => {
    generator = new SimpleMarkupToPdfReportGenerator(getReportName, markup);
    // Mock convertMarkupToPdf to avoid actual PDF conversion
    jest.spyOn(generator as any, 'convertMarkupToPdf')
      .mockImplementation(async (m: string) => Buffer.from(m));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should store markup in constructor', () => {
    expect(generator['markup']).toBe(markup);
  });

  it('should set report name function', () => {
    expect(generator.getReportName).toBe(getReportName);
  });

  describe('getFileBuffer', () => {
    it('should convert stored markup to PDF', async () => {
      const data = { test: 'data' };
      const result = await generator.getFileBuffer(data);

      expect(generator['convertMarkupToPdf']).toHaveBeenCalledWith(markup);
      expect(result).toEqual(Buffer.from(markup));
    });

    it('should ignore input data', async () => {
      const data1 = { test: 'data1' };
      const data2 = { test: 'data2' };

      const result1 = await generator.getFileBuffer(data1);
      const result2 = await generator.getFileBuffer(data2);

      expect(result1).toEqual(result2);
      expect(generator['convertMarkupToPdf']).toHaveBeenCalledTimes(2);
      expect(generator['convertMarkupToPdf']).toHaveBeenCalledWith(markup);
    });

    it('should handle PDF conversion errors', async () => {
      const error = new Error('PDF conversion error');
      jest.spyOn(generator as any, 'convertMarkupToPdf')
        .mockImplementation(() => Promise.reject(error));

      await expect(generator.getFileBuffer({})).rejects.toThrow(error);
    });
  });
});