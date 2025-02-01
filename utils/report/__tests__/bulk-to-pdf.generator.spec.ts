import { BulkToPdfReportGenerator } from '../bulk-to-pdf.generator';
import { BaseReportGenerator } from '../report.generators';
import { CommonFileFormat } from '../types';
import { PDFDocument } from 'pdf-lib';

describe('BulkToPdfReportGenerator', () => {
  let baseGenerator: BaseReportGenerator;
  let bulkGenerator: BulkToPdfReportGenerator;

  beforeEach(() => {
    baseGenerator = new class extends BaseReportGenerator {
      fileFormat = CommonFileFormat.Pdf;
      async getFileBuffer(data: any): Promise<Buffer> {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.addPage();
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
      }
    }(() => 'test');
    bulkGenerator = new BulkToPdfReportGenerator(baseGenerator);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(bulkGenerator).toBeDefined();
    });

    it('should set the correct file format', () => {
      expect(bulkGenerator.fileFormat).toBe(CommonFileFormat.Pdf);
    });

    it('should set the base generator', () => {
      expect(bulkGenerator.generator).toBe(baseGenerator);
    });

    it('should use the base generator getReportName', () => {
      expect(bulkGenerator.getReportName).toBe(baseGenerator.getReportName);
    });
  });

  describe('getReportData', () => {
    it('should call base generator getReportData for each item', async () => {
      const data = [1, 2, 3];
      const dataSource = {} as any;
      const baseGetReportData = jest.spyOn(baseGenerator, 'getReportData');
      
      await bulkGenerator.getReportData(data, dataSource);
      
      expect(baseGetReportData).toHaveBeenCalledTimes(3);
      expect(baseGetReportData).toHaveBeenCalledWith(1, dataSource);
      expect(baseGetReportData).toHaveBeenCalledWith(2, dataSource);
      expect(baseGetReportData).toHaveBeenCalledWith(3, dataSource);
    });
  });

  describe('getFileBuffer', () => {
    it('should create a PDF document from an array of data', async () => {
      const data = [1, 2, 3];
      const result = await bulkGenerator.getFileBuffer(data);
      
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should call base generator getFileBuffer for each item', async () => {
      const data = [1, 2, 3];
      const baseGetFileBuffer = jest.spyOn(baseGenerator, 'getFileBuffer');
      
      await bulkGenerator.getFileBuffer(data);
      
      expect(baseGetFileBuffer).toHaveBeenCalledTimes(3);
      expect(baseGetFileBuffer).toHaveBeenCalledWith(1);
      expect(baseGetFileBuffer).toHaveBeenCalledWith(2);
      expect(baseGetFileBuffer).toHaveBeenCalledWith(3);
    });

    it('should handle empty input array', async () => {
      const data = [];
      const result = await bulkGenerator.getFileBuffer(data);
      
      expect(result).toBeInstanceOf(Buffer);
      const pdfDoc = await PDFDocument.load(result);
      expect(pdfDoc.getPageCount()).toBe(1);
    });

    it('should handle invalid input by throwing error', async () => {
      const data = null;
      await expect(bulkGenerator.getFileBuffer(data)).rejects.toThrow();
    });
  });
});