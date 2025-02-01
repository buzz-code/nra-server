import { mergeStyles, getElementStyle, convertToReactStyle, getFontLinks, ReportElementStyle } from '../reportStyles';

describe('reportStyles', () => {
  describe('mergeStyles', () => {
    const defaultStyles: ReportElementStyle[] = [
      { type: 'header', fontSize: 16, fontFamily: 'Arial' },
      { type: 'body', fontSize: 12, fontFamily: 'Times New Roman' }
    ];

    it('should return default styles when user styles is empty', () => {
      expect(mergeStyles([], defaultStyles)).toEqual(defaultStyles);
    });

    it('should return default styles when user styles is null', () => {
      expect(mergeStyles(null, defaultStyles)).toEqual(defaultStyles);
    });

    it('should merge user styles with default styles', () => {
      const userStyles: ReportElementStyle[] = [
        { type: 'header', fontSize: 20, isBold: true }
      ];
      const expected = [
        { type: 'header', fontSize: 20, fontFamily: 'Arial', isBold: true },
        { type: 'body', fontSize: 12, fontFamily: 'Times New Roman' }
      ];
      expect(mergeStyles(userStyles, defaultStyles)).toEqual(expected);
    });

    it('should only override non-null/undefined user style properties', () => {
      const userStyles: ReportElementStyle[] = [
        { type: 'header', fontSize: null, isBold: true }
      ];
      const expected = [
        { type: 'header', fontFamily: 'Arial', fontSize: 16, isBold: true },
        { type: 'body', fontSize: 12, fontFamily: 'Times New Roman' }
      ];
      expect(mergeStyles(userStyles, defaultStyles)).toEqual(expected);
    });
  });

  describe('getElementStyle', () => {
    const styles: ReportElementStyle[] = [
      { type: 'default', fontSize: 12 },
      { type: 'header', fontSize: 16, isBold: true },
      { type: 'body', fontSize: 14 }
    ];

    it('should return matching style when found', () => {
      expect(getElementStyle('header', styles)).toEqual({ type: 'header', fontSize: 16, isBold: true });
    });

    it('should return first style when type not found', () => {
      expect(getElementStyle('unknown', styles)).toEqual({ type: 'default', fontSize: 12 });
    });
  });

  describe('convertToReactStyle', () => {
    it('should convert font family', () => {
      const style: ReportElementStyle = { type: 'test', fontFamily: 'Arial' };
      expect(convertToReactStyle(style)).toEqual({
        fontFamily: '"Arial", sans-serif'
      });
    });

    it('should convert font size', () => {
      const style: ReportElementStyle = { type: 'test', fontSize: 16 };
      expect(convertToReactStyle(style)).toEqual({
        fontSize: 16
      });
    });

    it('should convert bold style', () => {
      const style: ReportElementStyle = { type: 'test', isBold: true };
      expect(convertToReactStyle(style)).toEqual({
        fontWeight: 'bold'
      });
    });

    it('should convert italic style', () => {
      const style: ReportElementStyle = { type: 'test', isItalic: true };
      expect(convertToReactStyle(style)).toEqual({
        fontStyle: 'italic'
      });
    });

    it('should convert multiple properties', () => {
      const style: ReportElementStyle = {
        type: 'test',
        fontFamily: 'Arial',
        fontSize: 16,
        isBold: true,
        isItalic: true
      };
      expect(convertToReactStyle(style)).toEqual({
        fontFamily: '"Arial", sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fontStyle: 'italic'
      });
    });
  });

  describe('getFontLinks', () => {
    it('should generate Google Fonts links for unique fonts', () => {
      const styles: ReportElementStyle[] = [
        { type: 'header', fontFamily: 'Roboto' },
        { type: 'body', fontFamily: 'Open Sans' },
        { type: 'footer', fontFamily: 'Roboto' }
      ];
      const expected = [
        'https://fonts.googleapis.com/css2?family=Roboto&display=swap',
        'https://fonts.googleapis.com/css2?family=Open+Sans&display=swap'
      ];
      expect(getFontLinks(styles)).toEqual(expected);
    });

    it('should handle styles without font family', () => {
      const styles: ReportElementStyle[] = [
        { type: 'header', fontSize: 16 },
        { type: 'body', fontFamily: 'Roboto' }
      ];
      const expected = [
        'https://fonts.googleapis.com/css2?family=Roboto&display=swap'
      ];
      expect(getFontLinks(styles)).toEqual(expected);
    });

    it('should handle fonts with spaces', () => {
      const styles: ReportElementStyle[] = [
        { type: 'header', fontFamily: 'Source Sans Pro' }
      ];
      const expected = [
        'https://fonts.googleapis.com/css2?family=Source+Sans+Pro&display=swap'
      ];
      const result = getFontLinks(styles);
      // Check that spaces are properly replaced with plus signs
      expect(result[0]).not.toContain(' ');
      expect(result[0]).toContain('+');
      expect(result).toEqual(expected);
    });

    it('should return empty array when no fonts are specified', () => {
      const styles: ReportElementStyle[] = [
        { type: 'header', fontSize: 16 },
        { type: 'body', fontSize: 14 }
      ];
      expect(getFontLinks(styles)).toEqual([]);
    });
  });
});