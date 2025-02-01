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
      expect(mockPage.setContent).toHaveBeenCalledWith(markup);
      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'A4',
        printBackground: true
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