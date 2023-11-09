import { CommonFileFormat } from "@shared/utils/report/types";
import { DataSource } from "typeorm";


export type IGetReportDataFunction<T = any, U = any> = (params: T, dataSource: DataSource) => Promise<U>;

const defaultGetReportData = async x => x;

export abstract class BaseReportGenerator<T = any, U = any> {
    fileFormat: CommonFileFormat;
    constructor(
        public getReportName: (data: U) => string,
        public getReportData: IGetReportDataFunction<T, U> = null,
    ) {
        if (!this.getReportData) {
            this.getReportData = defaultGetReportData;
        }
    }
    abstract getFileBuffer(data: U): Promise<Buffer>;
}
