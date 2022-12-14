import { Get, StreamableFile, UseInterceptors } from "@nestjs/common";
import { CrudController, CrudRequest, CrudRequestInterceptor, ParsedRequest } from "@dataui/crud";
import { ExportFormats } from "@shared/exporter/types";
import { getExportedFile } from "@shared/exporter/exporterUtil";
import { BaseEntityService, IHasUserId } from "./base-entity.service";

export class BaseEntityController<T extends IHasUserId> implements CrudController<T> {
    constructor(public service: BaseEntityService<T>) { }

    protected async exportFile(req: CrudRequest, format: ExportFormats): Promise<StreamableFile> {
        const data = await this.service.getDataForExport(req);
        return getExportedFile(format, this.service.getName(), data, this.service.getExportHeaders());
    }


    @Get('/get-count')
    @UseInterceptors(CrudRequestInterceptor)
    getCount(@ParsedRequest() req: CrudRequest) {
        return this.service.getCount(req);
    }

    @Get('/export/excel')
    @UseInterceptors(CrudRequestInterceptor)
    exportExcel(@ParsedRequest() req: CrudRequest) {
        return this.exportFile(req, ExportFormats.Excel);
    }

    @Get('/export/pdf')
    @UseInterceptors(CrudRequestInterceptor)
    exportPdf(@ParsedRequest() req: CrudRequest) {
        return this.exportFile(req, ExportFormats.Pdf);
    }
}
