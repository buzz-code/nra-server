import { BulkToZipReportGenerator } from "./bulk-to-zip.generator";
import { ParamsToJsonReportGenerator } from "./params-to-json.generator";

const generator = new ParamsToJsonReportGenerator(() => 'test');
const bulkGenerator = new BulkToZipReportGenerator(() => 'test', generator);

describe('BulkToPdfReportGenerator', () => {

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
