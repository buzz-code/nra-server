import { CrudRequest } from "@dataui/crud";
import { RequestQueryParser } from '@dataui/crud-request';

export interface ImportFileBody {
    userId: number;
    base64File: string;
}

export const defaultReqObject: CrudRequest = {
    parsed: RequestQueryParser.create(),
    options: null,
}
