import { CreateManyDto, CrudRequest, Override } from "@dataui/crud";
import { TypeOrmCrudService } from "@dataui/crud-typeorm";
import { DeepPartial, EntityManager, Repository } from "typeorm";
import { snakeCase } from "change-case";
import { IHeader } from "@shared/utils/exporter/types";
import { Entity, ExportDefinition, IHasUserId, InjectEntityExporter, InjectEntityRepository } from "./interface";
import { CommonFileFormat, CommonFileResponse } from "@shared/utils/report/types";
import { getCommonFileResponse } from "@shared/utils/report/report.util";

export class BaseEntityService<T extends Entity> extends TypeOrmCrudService<T>{
    @InjectEntityExporter private exportDefinition: ExportDefinition;

    constructor(@InjectEntityRepository repo: Repository<T>) {
        super(repo);
    }

    getEntityManager(): EntityManager {
        return this.repo.manager;
    }

    getName(): string {
        return snakeCase(this.entityType.name);
    }

    @Override()
    createOne(req: CrudRequest<any>, dto: DeepPartial<T>): Promise<T> {
        this.insertUserDataBeforeCreate(dto, req.auth.id);
        return super.createOne(req, dto);
    }

    @Override()
    createMany(req: CrudRequest<any>, dto: CreateManyDto<DeepPartial<T>>): Promise<T[]> {
        dto.bulk.forEach(item => this.insertUserDataBeforeCreate(item, req.auth.id));
        return super.createMany(req, dto);
    }

    async getCount(req: CrudRequest): Promise<{ count: number }> {
        const { parsed, options } = req;
        const builder = await this.createBuilder(parsed, options);
        const count = await builder.getCount();
        return { count };
    }

    insertUserDataBeforeCreate(dto: DeepPartial<T>, userId: number) {
        if (!this.entityColumns.includes('userId')) {
            return;
        }

        const item = dto as IHasUserId;
        if (item.userId) {
            return dto;
        }

        item.userId = userId;
    }
    async getDataForExport(req: CrudRequest): Promise<any[]> {
        if (this.exportDefinition?.processReqForExport) {
            return this.exportDefinition.processReqForExport(req, this.getDataForExportInner.bind(this));
        } else {
            return this.getDataForExportInner(req);
        }
    }

    private async getDataForExportInner(req: CrudRequest): Promise<T[]> {
        const data = await this.getMany(req);
        return Array.isArray(data) ? data : data.data;
    }

    getExportHeaders(): IHeader[] {
        if (this.exportDefinition?.getExportHeaders) {
            return this.exportDefinition.getExportHeaders(this.entityColumns);
        } else {
            return this.entityColumns;
        }
    }

    getImportFields(): string[] {
        if (this.exportDefinition?.getImportFields) {
            return this.exportDefinition.getImportFields(this.entityColumns);
        } else {
            return this.entityColumns.filter(item => !['id', 'userId'].includes(item));
        }
    }

    async getReportData(req: CrudRequest): Promise<CommonFileResponse> {
        const buffer = Buffer.from(JSON.stringify(req.parsed.extra, null, '\t'));
        const name = this.getName() + '-extra';
        return getCommonFileResponse(buffer, CommonFileFormat.Json, name);
    }
}