import { CSSProperties } from 'react';
import { LOCAL_FONTS } from './localFonts';

export interface ReportElementStyle {
    type: string;
    fontFamily?: string;
    fontSize?: number;
    isBold?: boolean;
    isItalic?: boolean;
}

export type ReportStyles = ReportElementStyle[];
export function mergeStyles(userStyles: ReportStyles, defaultStyles: ReportStyles): ReportStyles {
    if (!userStyles || userStyles.length === 0) {
        return defaultStyles;
    }

    return defaultStyles.map(defaultStyle => {
        const userStyle = userStyles.find(style => style.type === defaultStyle.type);
        if (!userStyle) return defaultStyle;

        return {
            ...defaultStyle,
            ...Object.fromEntries(
                Object.entries(userStyle).filter(([_, value]) => value)
            )
        };
    });
}

export function getElementStyle(elementType: string, styles: ReportStyles): ReportElementStyle {
    return styles.find(style => style.type === elementType) || styles[0];
}

export function convertToReactStyle(elementStyle: ReportElementStyle): CSSProperties {
    const reactStyle: CSSProperties = {};
    if (elementStyle.fontFamily) {
        reactStyle.fontFamily = `"${elementStyle.fontFamily}", sans-serif`;
    }
    if (elementStyle.fontSize) {
        reactStyle.fontSize = elementStyle.fontSize;
    }
    if (elementStyle.isBold) {
        reactStyle.fontWeight = 'bold';
    }
    if (elementStyle.isItalic) {
        reactStyle.fontStyle = 'italic';
    }
    return reactStyle;
}

// Self-hosted @font-face CSS for whichever style fonts we have bundled locally
// (see localFonts.ts). No network request involved - fonts.googleapis.com is
// unreachable from the prod container and was hanging PDF generation for the
// full 30s Puppeteer navigation timeout. Fonts we haven't bundled are simply
// skipped: the browser falls back to sans-serif, same as it already silently
// does today whenever the Google Fonts fetch fails.
export function getFontFaceCss(styles: ReportElementStyle[]): string {
    const uniqueFonts = [...new Set(styles.map(style => style.fontFamily).filter(font => font))];
    return uniqueFonts
        .map(font => LOCAL_FONTS[font] && `@font-face { font-family: '${font}'; src: url(data:font/${LOCAL_FONTS[font].format};base64,${LOCAL_FONTS[font].base64}) format('${LOCAL_FONTS[font].format}'); font-weight: 400; font-style: normal; font-display: swap; }`)
        .filter(Boolean)
        .join('\n');
}