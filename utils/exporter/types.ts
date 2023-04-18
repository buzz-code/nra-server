export interface IColumn {
    label: string;
    value: string | ((value: IContent) => string | number | boolean | Date | IContent);
    // format?: string;
}

export type IHeader = IColumn | string;

export interface IContent {
    [key: string]: string | number | boolean | Date | IContent;
}

export type IFormatter = (row: any) => any;
