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
//
// A font can have multiple subset entries (e.g. hebrew + latin) - each needs
// its own @font-face with the matching unicode-range so the browser picks the
// right glyphs per character instead of only ever using the first subset.
export function getFontFaceCss(styles: ReportElementStyle[]): string {
    const uniqueFonts = [...new Set(styles.map(style => style.fontFamily).filter(font => font))];
    return uniqueFonts
        .flatMap(font => (LOCAL_FONTS[font] ?? []).map(face =>
            `@font-face { font-family: '${font}'; src: url(data:font/${face.format};base64,${face.base64}) format('${face.format}'); font-weight: 400; font-style: normal; font-display: swap;${face.unicodeRange ? ` unicode-range: ${face.unicodeRange};` : ''} }`
        ))
        .join('\n');
}