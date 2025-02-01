import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactToPdfReportGenerator } from '../react-to-pdf.generator';

jest.mock('react-dom/server');

describe('ReactToPdfReportGenerator', () => {
  // Mock React component
  const TestComponent: React.FunctionComponent<any> = () => null;
  const getReportName = jest.fn();
  const getReportData = jest.fn();
  let generator: ReactToPdfReportGenerator;

  beforeEach(() => {
    generator = new ReactToPdfReportGenerator(
      getReportName,
      getReportData,
      TestComponent
    );

    // Mock convertMarkupToPdf to avoid actual PDF conversion
    jest.spyOn(generator as any, 'convertMarkupToPdf')
      .mockImplementation(async (markup: string) => Buffer.from(markup));

    (renderToStaticMarkup as jest.Mock).mockReturnValue('<div>Test Markup</div>');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should store component reference', () => {
      expect(generator['component']).toBe(TestComponent);
    });

    it('should set report name function', () => {
      expect(generator.getReportName).toBe(getReportName);
    });

    it('should set report data function', () => {
      expect(generator.getReportData).toBe(getReportData);
    });
  });

  describe('getFileBuffer', () => {
    const testData = { prop: 'value' };

    it('should create React element with provided data', async () => {
      const createElementSpy = jest.spyOn(React, 'createElement');

      await generator.getFileBuffer(testData);

      expect(createElementSpy).toHaveBeenCalledWith(
        TestComponent,
        testData
      );
    });

    it('should render component to static markup', async () => {
      await generator.getFileBuffer(testData);

      expect(renderToStaticMarkup).toHaveBeenCalled();
    });

    it('should add DOCTYPE to rendered markup', async () => {
      await generator.getFileBuffer(testData);

      expect(generator['convertMarkupToPdf']).toHaveBeenCalledWith(
        '<!DOCTYPE html><div>Test Markup</div>'
      );
    });

    it('should convert markup to PDF', async () => {
      const result = await generator.getFileBuffer(testData);

      expect(generator['convertMarkupToPdf']).toHaveBeenCalled();
      expect(result).toEqual(
        Buffer.from('<!DOCTYPE html><div>Test Markup</div>')
      );
    });

    it('should handle rendering errors', async () => {
      const error = new Error('Rendering error');
      (renderToStaticMarkup as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(generator.getFileBuffer(testData)).rejects.toThrow(error);
    });

    it('should handle PDF conversion errors', async () => {
      const error = new Error('PDF conversion error');
      jest.spyOn(generator as any, 'convertMarkupToPdf')
        .mockImplementation(() => Promise.reject(error));

      await expect(generator.getFileBuffer(testData)).rejects.toThrow(error);
    });
  });
});