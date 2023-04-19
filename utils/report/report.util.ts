import { CommonFileFormat } from "./types";
import puppeteer from 'puppeteer';
import { renderToString } from 'react-dom/server';
import { createElement } from "react";
import { BaseReportGenerator } from "./report.generators";

export function getCommonFileResponse(buffer: Buffer, format: CommonFileFormat, name: string) {
    const type = getFileType(format);
    const disposition = getFileDisposition(format, name);
    return {
        data: buffer.toString('base64'),
        type,
        disposition,
    }
}

export function getFileType(format: CommonFileFormat): string {
    switch (format) {
        case CommonFileFormat.Excel:
            return 'application/vnd.ms-excel';
        case CommonFileFormat.Pdf:
            return 'application/pdf';
        case CommonFileFormat.Json:
            return 'application/json';
    }
}

export function getFileDisposition(format: CommonFileFormat, name: string): string {
    const timestamp = new Date().toISOString();
    switch (format) {
        case CommonFileFormat.Excel:
            return `attachment; filename="${name}-${timestamp}.xlsx"`
        case CommonFileFormat.Pdf:
            return `attachment; filename="${name}-${timestamp}.pdf"`
        case CommonFileFormat.Json:
            return `attachment; filename="${name}-${timestamp}.json"`
    }
}

export function getFileBuffer(generator: BaseReportGenerator, data: any): Promise<Buffer> {
    return generator.getFileBuffer(data);
}

export async function getPdfFile({ component, data }): Promise<Buffer> {
    const markup = renderToString(createElement(component, data));

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
