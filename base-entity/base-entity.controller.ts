import { CrudController, CrudRequest } from "@dataui/crud";
import { ExportFormats, ExportedFileResponse } from "@shared/exporter/types";
import { getExportedFile } from "@shared/exporter/exporterUtil";
import { BaseEntityService } from "./base-entity.service";
import { Entity } from "./interface";
import { parseExcelFile } from "@shared/importer/importerUtil";
import { ImportFileBody, defaultReqObject } from "@shared/importer/types";

export class BaseEntityController<T extends Entity> implements CrudController<T> {
    constructor(public service: BaseEntityService<T>) { }

    getCount(req: CrudRequest) {
        return this.service.getCount(req);
    }

    protected async exportFile(req: CrudRequest, format: ExportFormats): Promise<ExportedFileResponse> {
        const data = await this.service.getDataForExport(req);
        return getExportedFile(format, this.service.getName(), data, this.service.getExportHeaders());
    }

    protected async importExcelFile(body: ImportFileBody): Promise<string> {
        const bulk = await parseExcelFile(body.base64File, this.service.getImportFields());
        bulk.forEach(item => item.userId ??= body.userId);
        const created = await this.service.createMany(defaultReqObject, { bulk });
        return `${created.length} רשומות נשמרו בהצלחה`;
    }
}
