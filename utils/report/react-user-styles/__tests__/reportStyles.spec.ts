import { mergeStyles, getElementStyle, convertToReactStyle, getFontFaceCss, ReportElementStyle } from '../reportStyles';

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

  describe('getFontFaceCss', () => {
    it('should emit an inline @font-face for a locally bundled font, no network URL', () => {
      const styles: ReportElementStyle[] = [
        { type: 'header', fontFamily: 'Roboto' },
        { type: 'footer', fontFamily: 'Roboto' }
      ];
      const css = getFontFaceCss(styles);
      expect(css).toContain("@font-face");
      expect(css).toContain("font-family: 'Roboto'");
      expect(css).toContain('data:font/woff2;base64,');
      expect(css).not.toContain('fonts.googleapis.com');
      expect(css).not.toContain('http');
      // deduped: only one @font-face block even though Roboto appears twice
      expect(css.match(/@font-face/g)).toHaveLength(1);
    });

    it('should silently skip fonts with no local bundle instead of hitting the network', () => {
      const styles: ReportElementStyle[] = [
        { type: 'header', fontFamily: 'Arial' }
      ];
      expect(getFontFaceCss(styles)).toBe('');
    });

    it('should emit one @font-face per subset for a font with hebrew + latin, each with its own unicode-range', () => {
      const styles: ReportElementStyle[] = [
        { type: 'header', fontFamily: 'Assistant' }
      ];
      const css = getFontFaceCss(styles);
      expect(css.match(/@font-face/g)).toHaveLength(2);
      expect(css.match(/unicode-range:/g)).toHaveLength(2);
    });

    it('should handle styles without font family', () => {
      const styles: ReportElementStyle[] = [
        { type: 'header', fontSize: 16 },
        { type: 'body', fontFamily: 'Roboto' }
      ];
      const css = getFontFaceCss(styles);
      expect(css.match(/@font-face/g)).toHaveLength(1);
    });

    it('should return empty string when no fonts are specified', () => {
      const styles: ReportElementStyle[] = [
        { type: 'header', fontSize: 16 },
        { type: 'body', fontSize: 14 }
      ];
      expect(getFontFaceCss(styles)).toBe('');
    });
  });
});