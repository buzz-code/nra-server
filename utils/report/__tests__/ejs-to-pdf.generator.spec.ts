import { EjsToPdfReportGenerator } from '../ejs-to-pdf.generator';
import { MarkupToPdfReportGenerator } from '../markup-to-pdf.generator';
import * as ejs from 'ejs';

jest.mock('../markup-to-pdf.generator');
jest.mock('ejs');

describe('EjsToPdfReportGenerator', () => {
  let generator: EjsToPdfReportGenerator;
  let mockTemplate: jest.Mock;
  const getReportName = jest.fn();
  const getReportData = jest.fn();

  beforeEach(() => {
    mockTemplate = jest.fn();
    (ejs.compile as jest.Mock).mockReturnValue(mockTemplate);

    generator = new EjsToPdfReportGenerator(
      getReportName,
      getReportData,
      '<div><%= data.text %></div>'
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance of MarkupToPdfReportGenerator', () => {
      expect(generator).toBeInstanceOf(MarkupToPdfReportGenerator);
    });

    it('should compile template with provided options', () => {
      const templateStr = '<div><%= data.text %></div>';
      const options = { strict: true };

      new EjsToPdfReportGenerator(getReportName, getReportData, templateStr, options);

      expect(ejs.compile).toHaveBeenCalledWith(templateStr, options);
    });
  });

  describe('getFileBuffer', () => {
    it('should render template with provided data', async () => {
      const data = { text: 'Hello World' };
      const markup = '<div>Hello World</div>';
      mockTemplate.mockReturnValue(markup);

      await generator.getFileBuffer(data);

      expect(mockTemplate).toHaveBeenCalledWith(data);
    });

    it('should convert rendered markup to PDF', async () => {
      const data = { text: 'Hello World' };
      const markup = '<div>Hello World</div>';
      const pdfBuffer = Buffer.from('pdf content');
      mockTemplate.mockReturnValue(markup);
      
      // Mock the convertMarkupToPdf method from parent class
      jest.spyOn(generator as any, 'convertMarkupToPdf')
        .mockResolvedValue(pdfBuffer);

      const result = await generator.getFileBuffer(data);

      expect(generator['convertMarkupToPdf']).toHaveBeenCalledWith(markup);
      expect(result).toBe(pdfBuffer);
    });

    it('should handle template rendering errors', async () => {
      const data = { text: 'Hello World' };
      const error = new Error('Template error');
      mockTemplate.mockImplementation(() => {
        throw error;
      });

      await expect(generator.getFileBuffer(data)).rejects.toThrow(error);
    });

    it('should handle PDF conversion errors', async () => {
      const data = { text: 'Hello World' };
      const markup = '<div>Hello World</div>';
      const error = new Error('PDF conversion error');
      mockTemplate.mockReturnValue(markup);
      
      jest.spyOn(generator as any, 'convertMarkupToPdf')
        .mockRejectedValue(error);

      await expect(generator.getFileBuffer(data)).rejects.toThrow(error);
    });
  });
});