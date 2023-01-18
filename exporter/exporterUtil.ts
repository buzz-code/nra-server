import { StreamableFile } from "@nestjs/common";
import { ExportFormats, ExportedFileResponse, IFormatter, IHeader } from "./types";
import * as XLSX from 'xlsx';
import puppeteer from 'puppeteer';
import { renderToString } from 'react-dom/server';
import App from "./tableRenderer";
import { createElement } from "react";

export async function getExportedFile<T>(format: ExportFormats, name: string, data: T[], headers: IHeader[]): Promise<ExportedFileResponse> {
    const fileBuffer = await getFileBuffer(format, data, headers);
    const type = getFileType(format);
    const disposition = getFileDisposition(format, name);
    return {
        data: fileBuffer.toString('base64'),
        type,
        disposition,
    }
};

async function getFileBuffer<T>(format: ExportFormats, data: T[], headers: IHeader[]): Promise<Buffer> {
    const headerRow = getHeaderNames(headers);
    const formatters = getHeaderFormatters(headers)
    const formattedData = data.map(row => formatters.map(func => func(row)));

    switch (format) {
        case ExportFormats.Excel:
            return getExcelFile(headerRow, formattedData);
        case ExportFormats.Pdf:
            return getPdfFile(headerRow, formattedData);
        default:
            throw new Error('unknown format ' + format);
    }
}

function getHeaderNames(headers: IHeader[]): string[] {
    return headers.map(item => {
        if (typeof (item) === 'string') {
            return item;
        }
        return item.label;
    })
}

function getSimpleFormatter(key: string) {
    const parts = key?.split('.');
    return (row) => {
        if (!key) {
            return null;
        }
        let val = row;
        for (const part of parts) {
            val = val?.[part];
        }
        return val?.toString();
    }
}

function getHeaderFormatters(headers: IHeader[]): IFormatter[] {
    return headers.map(item => {
        if (typeof (item) === 'string') {
            return getSimpleFormatter(item);
        }
        if (typeof (item.value) === 'string') {
            return getSimpleFormatter(item.value);
        }
        return item.value;
    })
}

async function getExcelFile<T>(headerRow: string[], formattedData: string[][]): Promise<Buffer> {
    const ws = XLSX.utils.aoa_to_sheet([headerRow]);
    XLSX.utils.sheet_add_aoa(ws, formattedData, { origin: -1 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'גליון1');

    wb.Workbook ??= {}
    wb.Workbook.Views ??= [{}]
    wb.Workbook.Views.forEach((view) => {
        view.RTL = true;
    })

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return buffer;
}

async function getPdfFile<T>(headerRow: string[], formattedData: string[][]): Promise<Buffer> {
    const markup = renderToString(createElement(App, { headers: headerRow, rows: formattedData }));

    const browser = await puppeteer.launch({
        args: [
            "--disable-dev-shm-usage",
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    const page = await browser.newPage();

    await page.setContent(markup);

    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();

    return pdf;
}

function getFileType(format: ExportFormats): string {
    switch (format) {
        case ExportFormats.Excel:
            return 'application/vnd.ms-excel';
        case ExportFormats.Pdf:
            return 'application/pdf';
    }
}

function getFileDisposition(format: ExportFormats, name: string): string {
    const timestamp = new Date().toISOString();
    switch (format) {
        case ExportFormats.Excel:
            return `attachment; filename="${name}-${timestamp}.xlsx"`
        case ExportFormats.Pdf:
            return `attachment; filename="${name}-${timestamp}.pdf"`
    }
}
