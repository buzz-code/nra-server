import { CommonFileFormat } from "@shared/utils/report/types";
import { DataSource } from "typeorm";
import puppeteer from 'puppeteer';
import { renderToString } from 'react-dom/server';
import * as React from 'react';
import * as ejs from "ejs";
import { PDFDocument } from 'pdf-lib';
import { getFileExtension } from "./report.util";
import * as JSZip from 'jszip';
import * as ExcelJS from 'exceljs/dist/exceljs.min.js'


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


export class BulkToPdfReportGenerator extends BaseReportGenerator {
    fileFormat: CommonFileFormat = CommonFileFormat.Pdf;
    generator: BaseReportGenerator;

    constructor(
        generator: BaseReportGenerator,
    ) {
        super(generator.getReportName, null);
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

export class BulkToZipReportGenerator extends BaseReportGenerator {
    fileFormat: CommonFileFormat = CommonFileFormat.Zip;
    generator: BaseReportGenerator;

    constructor(
        getReportName: (data: any) => string,
        generator: BaseReportGenerator,
        getReportData?: IGetReportDataFunction<any, any>,
    ) {
        super(getReportName, null);
        this.generator = generator;
        if (getReportData) {
            this.getReportData = getReportData;
        } else {
            this.getReportData = (arr: any[], dataSource: DataSource) =>
                Promise.all(
                    arr.map(item => this.generator.getReportData(item, dataSource))
                );
        }
    }

    async getFileBuffer(data: any[]): Promise<Buffer> {
        var zip = new JSZip();
        const extension = getFileExtension(this.generator.fileFormat);
        let counter = 1;
        for (const item of data) {
            const buffer = await this.generator.getFileBuffer(item);
            const reportName = this.generator.getReportName(item);
            const filename = `${counter}_${reportName}.${extension}`;
            zip.file(filename, buffer);
            counter++;
        }
        return zip.generateAsync({ type: "nodebuffer" });
    }
}


abstract class MarkupToPdfReportGenerator<T = any, U = any> extends BaseReportGenerator<T, U> {
    fileFormat: CommonFileFormat = CommonFileFormat.Pdf;

    async convertMarkupToPdf(markup: string): Promise<Buffer> {
        if (this.fileFormat === CommonFileFormat.Html) {
            return Buffer.from(markup);
        }

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
        getReportName: (data: U) => string,
        getReportData: IGetReportDataFunction<T, U>,
        private component: React.FunctionComponent<U>,
    ) {
        super(getReportName, getReportData)
    }

    async getFileBuffer(data: U) {
        const markup = renderToString(React.createElement(this.component, data));
        return this.convertMarkupToPdf(markup);
    }
}


export class EjsToPdfReportGenerator<T = any, U = any> extends MarkupToPdfReportGenerator<T, U> {
    template: ejs.TemplateFunction | ejs.AsyncTemplateFunction;

    constructor(
        getReportName: (data: U) => string,
        getReportData: IGetReportDataFunction<T, U>,
        templateStr: string,
        ejsOptions: ejs.Options = undefined,
    ) {
        super(getReportName, getReportData)
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
        const workbook = new ExcelJS.Workbook();
        const sheetName = data.sheetName || 'גליון1';
        const worksheet = workbook.addWorksheet(sheetName);
        worksheet.views = [
            { state: 'frozen', xSplit: 1, rightToLeft: true }
        ];
        worksheet.addTable({
            name: 'data',
            ref: 'A1',
            headerRow: true,
            style: {
                theme: 'TableStyleMedium2',
                showRowStripes: true,
            },
            columns: data.headerRow.map(name => ({ name })),
            rows: data.formattedData,
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}


export class ParamsToJsonReportGenerator extends BaseReportGenerator {
    fileFormat: CommonFileFormat = CommonFileFormat.Json;

    async getFileBuffer(data: any): Promise<Buffer> {
        return Buffer.from(JSON.stringify(data, null, 2));
    }
}
