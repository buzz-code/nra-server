import { CrudController, CrudRequest } from "@dataui/crud";
import { ExportFormats, ExportedFileResponse } from "@shared/exporter/types";
import { getExportedFile } from "@shared/exporter/exporterUtil";
import { BaseEntityService } from "./base-entity.service";
import { Entity } from "./interface";

export class BaseEntityController<T extends Entity> implements CrudController<T> {
    constructor(public service: BaseEntityService<T>) { }

    getCount(req: CrudRequest) {
        return this.service.getCount(req);
    }

    protected async exportFile(req: CrudRequest, format: ExportFormats): Promise<ExportedFileResponse> {
        const data = await this.service.getDataForExport(req);
        return getExportedFile(format, this.service.getName(), data, this.service.getExportHeaders());
    }
}
