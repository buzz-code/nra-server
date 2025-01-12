export interface IColumn<T = IContent> {
    label: string;
    value: string | ((record: T) => string | number | boolean | Date | IContent);
}

export type IHeader<T = IContent> = IColumn<T> | string;

export interface IContent {
    [key: string]: string | number | boolean | Date | IContent;
}

export type IFormatter = (row: any) => any;
