import { CommonFileFormat } from "@shared/utils/report/types";
import { DataSource } from "typeorm";
import puppeteer from 'puppeteer';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import * as XLSX from 'xlsx-color';
import * as ejs from "ejs";
import { PDFDocument } from 'pdf-lib';


export type IGetReportDataFunction<T = any, U = any> = (params: T, dataSource: DataSource) => Promise<U>;

const defaultGetReportData = async x => x;

export abstract class BaseReportGenerator<T = any, U = any> {
    fileFormat: CommonFileFormat;
    constructor(
        public reportName: string,
        public getReportData: IGetReportDataFunction<T, U> = null,
    ) {
        if (!this.getReportData) {
            this.getReportData = defaultGetReportData;
        }
    }
    abstract getFileBuffer(data: U): Promise<Buffer>;
}


export class BulkToPdfReportGenerator extends BaseReportGenerator {
    fileFormat: CommonFileFormat = CommonFileFormat.Pdf;
    generator: BaseReportGenerator;

    constructor(
        generator: BaseReportGenerator,
    ) {
        super(generator.reportName, null);
        this.generator = generator;
        this.getReportData = (arr: any[], dataSource: DataSource) =>
            Promise.all(
                arr.map(item => this.generator.getReportData(item, dataSource))
            );
    }

    async getFileBuffer(data: any[]): Promise<Buffer> {
        const pdfDoc = await PDFDocument.create()
        for (const item of data) {
            const ItemPdfBytes = await this.generator.getFileBuffer(item);
            const itemPdfDoc = await PDFDocument.load(ItemPdfBytes);
            const itemPdfPages = await pdfDoc.copyPages(itemPdfDoc, itemPdfDoc.getPageIndices());
            itemPdfPages.forEach((page) => pdfDoc.addPage(page));
        }
        const pdfBytes = await pdfDoc.save()

        return Buffer.from(pdfBytes);
    }
}


abstract class MarkupToPdfReportGenerator<T = any, U = any> extends BaseReportGenerator<T, U> {
    fileFormat: CommonFileFormat = CommonFileFormat.Pdf;

    async convertMarkupToPdf(markup: string): Promise<Buffer> {
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


export class ReactToPdfReportGenerator<T = any, U = any> extends MarkupToPdfReportGenerator<T, U> {
    constructor(
        reportName: string,
        getReportData: IGetReportDataFunction<T, U>,
        private component: React.FunctionComponent<U>,
    ) {
        super(reportName, getReportData)
    }

    async getFileBuffer(data: U) {
        const markup = renderToString(React.createElement(this.component, data));
        return this.convertMarkupToPdf(markup);
    }
}


export class EjsToPdfReportGenerator<T = any, U = any> extends MarkupToPdfReportGenerator<T, U> {
    template: ejs.TemplateFunction | ejs.AsyncTemplateFunction;

    constructor(
        reportName: string,
        getReportData: IGetReportDataFunction<T, U>,
        templateStr: string,
        ejsOptions: ejs.Options = undefined,
    ) {
        super(reportName, getReportData)
        this.template = ejs.compile(templateStr, ejsOptions);
    }

    async getFileBuffer(data: U) {
        const markup = await this.template(data);
        return this.convertMarkupToPdf(markup);
    }
}


export interface IDataToExcelReportGenerator {
    headerRow: string[];
    formattedData: string[][];
    sheetName?: string;
}
export class DataToExcelReportGenerator extends BaseReportGenerator<IDataToExcelReportGenerator, IDataToExcelReportGenerator> {
    fileFormat: CommonFileFormat = CommonFileFormat.Excel;

    async getFileBuffer(data: IDataToExcelReportGenerator): Promise<Buffer> {
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


export class ParamsToJsonReportGenerator extends BaseReportGenerator {
    fileFormat: CommonFileFormat = CommonFileFormat.Json;

    async getFileBuffer(data: any): Promise<Buffer> {
        return Buffer.from(JSON.stringify(data, null, 2));
    }
}
