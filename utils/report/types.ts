export interface CommonFileResponse {
    data: string;
    type: string;
    disposition: string;
}

export enum CommonFileFormat {
    Excel,
    Pdf,
    Json,
};
