import * as ejs from "ejs";
import { MarkupToPdfReportGenerator } from "./markup-to-pdf.generator";
import { IGetReportDataFunction } from "./report.generators";

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
