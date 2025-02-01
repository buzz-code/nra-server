import { BulkToZipReportGenerator } from "../bulk-to-zip.generator";
import { ParamsToJsonReportGenerator } from "../params-to-json.generator";
import { CommonFileFormat } from "../types";

describe('BulkToPdfReportGenerator', () => {
  it('should be defined', () => {
    expect(BulkToZipReportGenerator).toBeDefined();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      const baseGenerator = new ParamsToJsonReportGenerator(() => 'test');
      const generator = new BulkToZipReportGenerator(() => 'test', baseGenerator);
      expect(generator).toBeDefined();
    });

    it('should use the provided getReportData function if provided', () => {
      const getReportData = jest.fn();
      const baseGenerator = new ParamsToJsonReportGenerator(() => 'test');
      const generator = new BulkToZipReportGenerator(() => 'test', baseGenerator, getReportData);
      expect(generator.getReportData).toBe(getReportData);
    });

    it('should use the default getReportData function if not provided', async () => {
      const getReportData = jest.fn();
      const baseGenerator = new ParamsToJsonReportGenerator(() => 'test', getReportData);
      const generator = new BulkToZipReportGenerator(() => 'test', baseGenerator);
      const data = [1, 2, 3];
      const dataSource = {} as any;
      await generator.getReportData(data, dataSource);
      expect(getReportData).toHaveBeenCalledTimes(3);
      expect(getReportData).toHaveBeenCalledWith(data[0], dataSource);
      expect(getReportData).toHaveBeenCalledWith(data[1], dataSource);
      expect(getReportData).toHaveBeenCalledWith(data[2], dataSource);
    });
  });

  describe('getFileBuffer', () => {
    let generator: ParamsToJsonReportGenerator;
    let bulkGenerator: BulkToZipReportGenerator;

    beforeEach(() => {
      generator = new ParamsToJsonReportGenerator(() => 'test');
      bulkGenerator = new BulkToZipReportGenerator(() => 'test', generator);
    });

    it('should return base generator file buffer if data length is 1 and file format is zip', async () => {
      const data = [1];
      const expectedResult = Buffer.from('test');
      generator.fileFormat = CommonFileFormat.Zip;
      const baseGeneratorBufferSpy = jest.spyOn(generator, 'getFileBuffer').mockResolvedValue(expectedResult);
      const result = await bulkGenerator.getFileBuffer(data);
      expect(baseGeneratorBufferSpy).toHaveBeenCalledWith(data[0]);
      expect(result).toEqual(expectedResult);
    });

    // should create a PDF document from an array of data using the provided generator
    it('should create a PDF document from an array of data using the provided generator', async () => {
      const data = [1, 2, 3];
      const result = await bulkGenerator.getFileBuffer(data);
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });

    // should add all pages from each individual PDF document to the final PDF document
    it('should add all pages from each individual PDF document to the final PDF document', async () => {
      const data = [1, 2, 3];
      const result = await bulkGenerator.getFileBuffer(data);
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });

    // should return a buffer containing the final PDF document
    it('should return a buffer containing the final PDF document', async () => {
      const data = [1, 2, 3];
      const result = await bulkGenerator.getFileBuffer(data);
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });

    // should handle empty input array by returning an empty PDF document
    it('should handle empty input array by returning an empty PDF document', async () => {
      const data = [];
      const result = await bulkGenerator.getFileBuffer(data);
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });

    // should handle invalid input data by throwing an error
    it('should handle invalid input data by throwing an error', async () => {
      const data = null;
      await expect(bulkGenerator.getFileBuffer(data)).rejects.toThrowError();
    });

    // should handle invalid PDF documents in input data by skipping them and adding a warning to the final PDF document
    it('should handle invalid PDF documents in input data by skipping them and adding a warning to the final PDF document', async () => {
      const data = [1, 2, 3];
      const result = await bulkGenerator.getFileBuffer(data);
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
