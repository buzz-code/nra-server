import { getExportedFile } from '../exporter.util';
import { CommonFileFormat } from '../../report/types';
import { DataToExcelReportGenerator } from '../../report/data-to-excel.generator';
import { ReactToPdfReportGenerator } from '../../report/react-to-pdf.generator';
import { ParamsToJsonReportGenerator } from '../../report/params-to-json.generator';
import { IHeader } from '../types';
import { BadRequestException } from '@nestjs/common';
import * as reportUtil from '../../report/report.util';

jest.mock('../../report/data-to-excel.generator');
jest.mock('../../report/react-to-pdf.generator');
jest.mock('../../report/params-to-json.generator');
jest.mock('../../report/report.util');

describe('exporter.util', () => {
  const mockData = [
    { id: 1, name: 'John', age: 30, date: new Date('2024-01-01'), nested: { value: 'test' } },
    { id: 2, name: 'Jane', age: 25, date: new Date('2024-01-02'), nested: { value: 'test2' } }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (reportUtil.generateCommonFileResponse as jest.Mock).mockResolvedValue({
      data: 'mock-data',
      type: 'application/json',
      disposition: 'attachment'
    });

    // Mock the generator implementations
    (DataToExcelReportGenerator as jest.Mock).mockImplementation(() => ({
      getReportName: jest.fn().mockReturnValue('test'),
      getReportData: jest.fn(),
      generate: jest.fn()
    }));

    (ReactToPdfReportGenerator as jest.Mock).mockImplementation(() => ({
      getReportName: jest.fn().mockReturnValue('test'),
      getReportData: jest.fn(),
      generate: jest.fn()
    }));

    (ParamsToJsonReportGenerator as jest.Mock).mockImplementation(() => ({
      getReportName: jest.fn().mockReturnValue('test'),
      getReportData: jest.fn(),
      generate: jest.fn()
    }));
  });

  describe('getExportedFile', () => {
    it('should handle string headers', async () => {
      const headers: IHeader[] = ['id', 'name', 'age'];
      const expectedHeaderRow = ['id', 'name', 'age'];
      const expectedData = [
        ['1', 'John', '30'],
        ['2', 'Jane', '25']
      ];

      await getExportedFile(CommonFileFormat.Excel, 'test', mockData, headers);

      expect(DataToExcelReportGenerator).toHaveBeenCalledWith(expect.any(Function));
      expect(reportUtil.generateCommonFileResponse).toHaveBeenCalledWith(
        expect.any(Object),
        {
          headerRow: expectedHeaderRow,
          formattedData: expectedData
        },
        null
      );
    });

    it('should handle object headers with labels', async () => {
      const headers: IHeader[] = [
        { value: 'id', label: 'ID' },
        { value: 'name', label: 'Name' },
        { value: 'age', label: 'Age' }
      ];
      const expectedHeaderRow = ['ID', 'Name', 'Age'];
      const expectedData = [
        ['1', 'John', '30'],
        ['2', 'Jane', '25']
      ];

      await getExportedFile(CommonFileFormat.Excel, 'test', mockData, headers);

      expect(DataToExcelReportGenerator).toHaveBeenCalledWith(expect.any(Function));
      expect(reportUtil.generateCommonFileResponse).toHaveBeenCalledWith(
        expect.any(Object),
        {
          headerRow: expectedHeaderRow,
          formattedData: expectedData
        },
        null
      );
    });

    it('should handle custom formatter functions', async () => {
      const headers: IHeader[] = [
        { value: 'id', label: 'ID' },
        { value: record => `${record.name} (${record.age})`, label: 'Info' }
      ];
      const expectedHeaderRow = ['ID', 'Info'];
      const expectedData = [
        ['1', 'John (30)'],
        ['2', 'Jane (25)']
      ];

      await getExportedFile(CommonFileFormat.Excel, 'test', mockData, headers);

      expect(DataToExcelReportGenerator).toHaveBeenCalledWith(expect.any(Function));
      expect(reportUtil.generateCommonFileResponse).toHaveBeenCalledWith(
        expect.any(Object),
        {
          headerRow: expectedHeaderRow,
          formattedData: expectedData
        },
        null
      );
    });

    it('should handle nested object paths', async () => {
      const headers: IHeader[] = [
        { value: 'nested.value', label: 'Nested Value' }
      ];
      const expectedHeaderRow = ['Nested Value'];
      const expectedData = [
        ['test'],
        ['test2']
      ];

      await getExportedFile(CommonFileFormat.Excel, 'test', mockData, headers);

      expect(DataToExcelReportGenerator).toHaveBeenCalledWith(expect.any(Function));
      expect(reportUtil.generateCommonFileResponse).toHaveBeenCalledWith(
        expect.any(Object),
        {
          headerRow: expectedHeaderRow,
          formattedData: expectedData
        },
        null
      );
    });

    it('should format dates correctly', async () => {
      const headers: IHeader[] = [
        { value: 'date', label: 'Date' }
      ];
      const expectedHeaderRow = ['Date'];
      // Using he-IL locale for date formatting
      const expectedData = [
        ['1.1.2024'],
        ['2.1.2024']
      ];

      await getExportedFile(CommonFileFormat.Excel, 'test', mockData, headers);

      expect(DataToExcelReportGenerator).toHaveBeenCalledWith(expect.any(Function));
      expect(reportUtil.generateCommonFileResponse).toHaveBeenCalledWith(
        expect.any(Object),
        {
          headerRow: expectedHeaderRow,
          formattedData: expectedData
        },
        null
      );
    });

    it('should handle PDF format', async () => {
      const headers: IHeader[] = ['id', 'name'];
      const expectedHeaderRow = ['id', 'name'];
      const expectedData = [
        ['1', 'John'],
        ['2', 'Jane']
      ];

      await getExportedFile(CommonFileFormat.Pdf, 'test', mockData, headers);

      expect(ReactToPdfReportGenerator).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle JSON format', async () => {
      const headers: IHeader[] = ['id', 'name'];
      const expectedHeaderRow = ['id', 'name'];
      const expectedData = [
        ['1', 'John'],
        ['2', 'Jane']
      ];

      await getExportedFile(CommonFileFormat.Json, 'test', mockData, headers);

      expect(ParamsToJsonReportGenerator).toHaveBeenCalledWith(expect.any(Function));
      expect(reportUtil.generateCommonFileResponse).toHaveBeenCalledWith(
        expect.any(Object),
        {
          headerRow: expectedHeaderRow,
          formattedData: expectedData
        },
        null
      );
    });

    it('should throw error for unknown format', async () => {
      const headers: IHeader[] = ['id', 'name'];

      await expect(getExportedFile(99 as CommonFileFormat, 'test', mockData, headers))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should handle null values in nested paths', async () => {
      const dataWithNull = [
        { id: 1, nested: null },
        { id: 2, nested: { value: 'test' } }
      ];

      const headers: IHeader[] = [
        { value: 'nested.value', label: 'Nested Value' }
      ];
      const expectedHeaderRow = ['Nested Value'];
      const expectedData = [
        [undefined],
        ['test']
      ];

      await getExportedFile(CommonFileFormat.Excel, 'test', dataWithNull, headers);

      expect(DataToExcelReportGenerator).toHaveBeenCalledWith(expect.any(Function));
      expect(reportUtil.generateCommonFileResponse).toHaveBeenCalledWith(
        expect.any(Object),
        {
          headerRow: expectedHeaderRow,
          formattedData: expectedData
        },
        null
      );
    });
  });
});