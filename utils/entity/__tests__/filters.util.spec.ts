import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { getReportDateFilter, dateFromString } from '../filters.util';

describe('filters.util', () => {
  describe('getReportDateFilter', () => {
    const baseDate = new Date('2023-01-01');
    const laterDate = new Date('2023-12-31');

    it('should return Between when both dates are provided', () => {
      const result = getReportDateFilter(baseDate, laterDate);
      expect(result).toEqual(Between(baseDate, laterDate));
    });

    it('should return MoreThanOrEqual when only fromDate is provided', () => {
      const result = getReportDateFilter(baseDate, null);
      expect(result).toEqual(MoreThanOrEqual(baseDate));
    });

    it('should return LessThanOrEqual when only toDate is provided', () => {
      const result = getReportDateFilter(null, laterDate);
      expect(result).toEqual(LessThanOrEqual(laterDate));
    });

    it('should return undefined when no dates are provided', () => {
      const result = getReportDateFilter(null, null);
      expect(result).toBeUndefined();
    });
  });

  describe('dateFromString', () => {
    it('should convert valid date string to Date object', () => {
      const dateStr = '2023-01-01';
      const result = dateFromString(dateStr);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toContain('2023-01-01');
    });

    it('should handle invalid date string', () => {
      const dateStr = 'invalid-date';
      const result = dateFromString(dateStr);
      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      const result = dateFromString('');
      expect(result).toBeNull();
    });

    it('should handle undefined input', () => {
      const result = dateFromString(undefined);
      expect(result).toBeNull();
    });
  });
});