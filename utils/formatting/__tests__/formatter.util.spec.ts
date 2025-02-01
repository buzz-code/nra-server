import { formatJewishDateInHebrew, toJewishDate } from 'jewish-date';
import { formatPercent, getPercentsFormatter, getHebrewDateFormatter, formatHebrewDate, formatJson, getJsonFormatter } from '../formatter.util';

jest.mock('jewish-date', () => ({
  formatJewishDateInHebrew: jest.fn(),
  toJewishDate: jest.fn(),
}));

describe('Formatter Utils', () => {
  describe('formatPercent', () => {
    it('should format valid numbers to percentages', () => {
      expect(formatPercent(0.5)).toBe('50%');
      expect(formatPercent(1)).toBe('100%');
      expect(formatPercent(0)).toBe('0%');
      expect(formatPercent(0.753, 1)).toBe('75.3%');
    });

    it('should handle edge cases', () => {
      expect(formatPercent(null)).toBeNull();
      expect(formatPercent(undefined)).toBeNull();
      expect(formatPercent('invalid')).toBeNull();
      expect(formatPercent(NaN)).toBeNull();
    });
  });

  describe('getPercentsFormatter', () => {
    it('should create a formatter function that formats row values', () => {
      const formatter = getPercentsFormatter('percent');
      const row = { percent: 0.75 };
      expect(formatter(row)).toBe('75%');
    });

    it('should handle fraction digits', () => {
      const formatter = getPercentsFormatter('percent', 2);
      const row = { percent: 0.7533 };
      expect(formatter(row)).toBe('75.33%');
    });

    it('should handle invalid row values', () => {
      const formatter = getPercentsFormatter('percent');
      expect(formatter({})).toBeNull();
      expect(formatter({ percent: null })).toBeNull();
      expect(formatter({ percent: 'invalid' })).toBeNull();
    });
  });

  describe('formatHebrewDate', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should format valid dates', () => {
      const mockDate = new Date('2024-01-29');
      const mockJewishDate = { some: 'date' };
      const mockFormattedDate = 'כ״ט בטבת תשפ״ד';

      (toJewishDate as jest.Mock).mockReturnValue(mockJewishDate);
      (formatJewishDateInHebrew as jest.Mock).mockReturnValue(mockFormattedDate);

      expect(formatHebrewDate(mockDate)).toBe(mockFormattedDate);
      expect(toJewishDate).toHaveBeenCalledWith(mockDate);
      expect(formatJewishDateInHebrew).toHaveBeenCalledWith(mockJewishDate);
    });

    it('should handle null/undefined values', () => {
      expect(formatHebrewDate(null)).toBeNull();
      expect(formatHebrewDate(undefined)).toBeNull();
      expect(toJewishDate).not.toHaveBeenCalled();
      expect(formatJewishDateInHebrew).not.toHaveBeenCalled();
    });
  });

  describe('getHebrewDateFormatter', () => {
    it('should create a formatter function that formats dates in rows', () => {
      const mockDate = new Date('2024-01-29');
      const mockJewishDate = { some: 'date' };
      const mockFormattedDate = 'כ״ט בטבת תשפ״ד';

      (toJewishDate as jest.Mock).mockReturnValue(mockJewishDate);
      (formatJewishDateInHebrew as jest.Mock).mockReturnValue(mockFormattedDate);

      const formatter = getHebrewDateFormatter('date');
      const row = { date: mockDate };
      expect(formatter(row)).toBe(mockFormattedDate);
    });

    it('should handle missing or invalid dates in rows', () => {
      const formatter = getHebrewDateFormatter('date');
      expect(formatter({})).toBeNull();
      expect(formatter({ date: null })).toBeNull();
      expect(formatter({ date: 'invalid' })).toBeNull();
    });
  });

  describe('formatJson', () => {
    it('should format valid JSON objects', () => {
      const obj = { key: 'value' };
      expect(formatJson(obj)).toBe('{"key":"value"}');
    });

    it('should handle arrays', () => {
      const arr = [1, 2, 3];
      expect(formatJson(arr)).toBe('[1,2,3]');
    });

    it('should handle null/undefined values', () => {
      expect(formatJson(null)).toBeNull();
      expect(formatJson(undefined)).toBeNull();
    });
  });

  describe('getJsonFormatter', () => {
    it('should create a formatter function that formats JSON in rows', () => {
      const formatter = getJsonFormatter('data');
      const row = { data: { key: 'value' } };
      expect(formatter(row)).toBe('{"key":"value"}');
    });

    it('should handle invalid or missing JSON in rows', () => {
      const formatter = getJsonFormatter('data');
      expect(formatter({})).toBeNull();
      expect(formatter({ data: null })).toBeNull();
      expect(formatter({ data: undefined })).toBeNull();
    });
  });
});