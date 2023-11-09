import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkupToPdfReportGenerator } from "./markup-to-pdf.generator";
import { IGetReportDataFunction } from "./report.generators";

export class ReactToPdfReportGenerator<T = any, U = any> extends MarkupToPdfReportGenerator<T, U> {
    constructor(
        getReportName: (data: U) => string,
        getReportData: IGetReportDataFunction<T, U>,
        private component: React.FunctionComponent<U>,
    ) {
        super(getReportName, getReportData)
    }

    async getFileBuffer(data: U) {
        const element = React.createElement(this.component, data);
        const markup = '<!DOCTYPE html>' + renderToStaticMarkup(element);
        return this.convertMarkupToPdf(markup);
    }
}
