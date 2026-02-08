import { formatHebrewDateForIVR } from '../hebrew.util';

describe('hebrew.util', () => {
  describe('formatHebrewDateForIVR', () => {
    it('should format a Date object correctly', () => {
      const date = new Date(2026, 1, 8); // February 8, 2026
      // 21 Shevat 5786
      const result = formatHebrewDateForIVR(date);
      expect(result).toContain('שְׁבָט');
      expect(result).toContain('כַּף אָלֶף');
    });

    it('should format a string date correctly', () => {
      const dateStr = '2026-02-08';
      const result = formatHebrewDateForIVR(dateStr);
      expect(result).toContain('שְׁבָט');
      expect(result).toContain('כַּף אָלֶף');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatHebrewDateForIVR(null)).toBe('');
      expect(formatHebrewDateForIVR(undefined as any)).toBe('');
    });
  });
});
