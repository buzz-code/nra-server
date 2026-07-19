import { CSSProperties } from 'react';

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

export function getFontLinks(styles: ReportElementStyle[]): string[] {
    const uniqueFonts = [...new Set(styles.map(style => style.fontFamily).filter(font => font))];
    return uniqueFonts.map(font => 
        `https://fonts.googleapis.com/css2?family=${font.split(' ').join('+')}&display=swap`
    );
}