import { CrudRequest } from "@dataui/crud";
import { RequestQueryParser } from '@dataui/crud-request';
import * as XLSX from 'xlsx';

export interface ImportFileBody {
    userId: number;
    base64File: string;
}

export const defaultReqObject: CrudRequest = {
    parsed: RequestQueryParser.create(),
    options: null,
}

export interface ISpecialField {
    cell: XLSX.CellAddress;
    value: string | number;
}

export interface IHardCodedField {
    field: string;
    value: any;
}
