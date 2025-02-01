import { isExcelFileExtension, parseExcelFile, parseExcelFileAdvanced } from '../importer.util';
import * as XLSX from 'xlsx';

jest.mock('xlsx');

describe('importer.util', () => {
  describe('isExcelFileExtension', () => {
    it('should return true for supported extensions', () => {
      const supportedFiles = [
        'test.xlsx',
        'test.csv',
        'test.xls',
        'test.ods',
        'test.txt'
      ];

      supportedFiles.forEach(filename => {
        expect(isExcelFileExtension(filename)).toBe(true);
      });
    });

    it('should return false for unsupported extensions', () => {
      const unsupportedFiles = [
        'test.pdf',
        'test.doc',
        'test.jpg',
        'test',
      ];

      unsupportedFiles.forEach(filename => {
        expect(isExcelFileExtension(filename)).toBe(false);
      });
    });
  });

  describe('parseExcelFile', () => {
    const mockWorksheet = {
      '!ref': 'A1:C3',
      'A1': { v: 'Name' },
      'B1': { v: 'Age' },
      'C1': { v: 'City' },
      'A2': { v: 'John' },
      'B2': { v: 30 },
      'C2': { v: 'New York' },
      'A3': { v: 'Jane' },
      'B3': { v: 25 },
      'C3': { v: 'London' }
    };

    const mockWorkbook = {
      SheetNames: ['Sheet1'],
      Sheets: {
        'Sheet1': mockWorksheet
      }
    };

    beforeEach(() => {
      (XLSX.read as jest.Mock).mockReturnValue(mockWorkbook);
      (XLSX.utils.sheet_to_json as jest.Mock).mockImplementation((ws, opts) => {
        const skipRows = opts?.range || 1;
        const data = [
          { name: 'John', age: 30, city: 'New York' },
          { name: 'Jane', age: 25, city: 'London' }
        ];
        return data.slice(skipRows - 1);
      });
    });

    it('should parse excel file with correct headers', async () => {
      const fields = ['name', 'age', 'city'];
      const base64String = 'mock-base64-string';
      
      const result = await parseExcelFile(base64String, fields);
      
      expect(XLSX.read).toHaveBeenCalledWith(base64String, {
        type: 'base64',
        cellText: false,
        cellDates: true
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'John',
        age: 30,
        city: 'New York'
      });
    });

    it('should skip specified number of rows', async () => {
      const fields = ['name', 'age', 'city'];
      const base64String = 'mock-base64-string';
      const rowsToSkip = 2;
      
      const result = await parseExcelFile(base64String, fields, rowsToSkip);
      
      expect(XLSX.utils.sheet_to_json).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          header: fields,
          range: rowsToSkip
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'Jane',
        age: 25,
        city: 'London'
      });
    });
  });

  describe('parseExcelFileAdvanced', () => {
    const mockWorksheet = {
      '!ref': 'A1:C4',
      'A1': { v: 'School:' },
      'B1': { v: 'High School' },
      'A2': { v: 'Year:' },
      'B2': { v: '2024' },
      'A3': { v: 'Name' },
      'B3': { v: 'Grade' },
      'A4': { v: 'John' },
      'B4': { v: 95 }
    };

    const mockWorkbook = {
      SheetNames: ['Sheet1'],
      Sheets: {
        'Sheet1': mockWorksheet
      }
    };

    beforeEach(() => {
      (XLSX.read as jest.Mock).mockReturnValue(mockWorkbook);
      (XLSX.utils.sheet_to_json as jest.Mock).mockImplementation((ws, opts) => {
        const skipRows = opts?.range || 1;
        return [{
          name: 'John',
          grade: 95
        }];
      });
      (XLSX.utils.encode_cell as jest.Mock).mockImplementation(({ r, c }) => {
        const col = String.fromCharCode(65 + c);
        return `${col}${r + 1}`;
      });
    });

    it('should parse excel file with special fields', async () => {
      const fields = ['name', 'grade'];
      const specialFields = [
        { cell: { r: 0, c: 1 }, value: 'school' },
        { cell: { r: 1, c: 1 }, value: 'year' }
      ];
      const base64String = 'mock-base64-string';
      
      const result = await parseExcelFileAdvanced(base64String, fields, specialFields);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'John',
        grade: 95,
        school: 'High School',
        year: '2024'
      });

      expect(XLSX.read).toHaveBeenCalledWith(base64String, {
        type: 'base64',
        cellText: false,
        cellDates: true
      });
      expect(XLSX.utils.encode_cell).toHaveBeenCalledWith({ r: 0, c: 1 });
    });

    it('should handle missing special field values', async () => {
      const fields = ['name', 'grade'];
      const specialFields = [
        { cell: { r: 0, c: 1 }, value: 'school' },
        { cell: { r: 5, c: 5 }, value: 'nonexistent' } // Cell that doesn't exist
      ];
      const base64String = 'mock-base64-string';
      
      const result = await parseExcelFileAdvanced(base64String, fields, specialFields);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'John',
        grade: 95,
        school: 'High School',
        nonexistent: undefined
      });

      expect(XLSX.utils.encode_cell).toHaveBeenCalledWith({ r: 5, c: 5 });
    });
  });
});