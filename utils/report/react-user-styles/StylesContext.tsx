import * as React from 'react';
import { ReportStyles, getElementStyle, getFontLinks, mergeStyles } from './reportStyles';

const StylesContext = React.createContext<ReportStyles>([]);
export default StylesContext;

interface StylesProviderProps {
    value: ReportStyles;
    defaultStyles: ReportStyles;
    children: React.ReactNode;
}
export const StylesProvider: React.FC<StylesProviderProps> = ({ value, defaultStyles, children }) => {
    const mergedStyles = React.useMemo(() => {
        return mergeStyles(value, defaultStyles);
    }, [value, defaultStyles]);

    return (
        <StylesContext.Provider value={mergedStyles}>
            {children}
        </StylesContext.Provider>
    );
};

export const useStyles = (elementType: string): ReportStyles[number] => {
    const styles = React.useContext(StylesContext);
    return getElementStyle(elementType, styles);
};

export const useFontLinks = (): string[] => {
    const styles = React.useContext(StylesContext);
    return getFontLinks(styles);
}

interface IUserStyles {
    userStyles: ReportStyles;
}
export const wrapWithStyles = (Component: React.ComponentType<any>, defaultStyles: ReportStyles) => {
    return (props: IUserStyles) => {
        const { userStyles } = props;
        return (
            <StylesProvider value={userStyles} defaultStyles={defaultStyles}>
                <Component {...props} />
            </StylesProvider>
        );
    };
}
