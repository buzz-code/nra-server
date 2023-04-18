import { CommonFileFormat } from "@shared/utils/report/types";
import { DataSource } from "typeorm";
import puppeteer from 'puppeteer';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import * as XLSX from 'xlsx-color';


export interface IReportData {}
export type IGetReportDataFunction<T = any> = (dataSource: DataSource, params: T) => Promise<IReportData>;
export abstract class BaseReportDefinition {
    fileFormat: CommonFileFormat;
    constructor(public reportName: string, public getReportData: IGetReportDataFunction) { }
    abstract getFileBuffer(data): Promise<Buffer>;
}


export class ReactToPdfReportDefinition<T extends IReportData> extends BaseReportDefinition {
    constructor(reportName: string, getReportData: IGetReportDataFunction, private component: React.FunctionComponent<T>) {
        super(reportName, getReportData)
        this.fileFormat = CommonFileFormat.Pdf;
    }

    async getFileBuffer(data: T) {
        const markup = renderToString(React.createElement(this.component, data));

        const browser = await puppeteer.launch({
            args: [
                "--disable-dev-shm-usage",
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
        const page = await browser.newPage();

        await page.setContent(markup);

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true
        });
        await browser.close();

        return pdf;
    }
}


export interface IDataToExcelReportDefinition {
    headerRow: string[];
    formattedData: string[][];
    sheetName?: string;
}
export class DataToExcelReportDefinition<T extends IReportData> extends BaseReportDefinition {
    constructor(reportName: string, getReportData: IGetReportDataFunction) {
        super(reportName, getReportData);
        this.fileFormat = CommonFileFormat.Excel;
    }

    async getFileBuffer(data: IDataToExcelReportDefinition): Promise<Buffer> {
        const ws = XLSX.utils.aoa_to_sheet([data.headerRow]);
        XLSX.utils.sheet_add_aoa(ws, data.formattedData, { origin: -1 });

        for (let index = 0; index < data.headerRow.length; index++) {
            var cell_ref = XLSX.utils.encode_cell({ c: index, r: 0 });
            ws[cell_ref].s = {
                font: {
                    bold: true
                },
                fill: {
                    fgColor: { rgb: "f2f2f2" }
                }
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, data.sheetName || 'גליון1');

        wb.Workbook ??= {}
        wb.Workbook.Views ??= [{}]
        wb.Workbook.Views.forEach((view) => {
            view.RTL = true;
        })

        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        return buffer;
    }
}
