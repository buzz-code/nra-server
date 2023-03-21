import { Inject } from "@nestjs/common";
import { CreateManyDto, CrudRequest, Override } from "@dataui/crud";
import { TypeOrmCrudService } from "@dataui/crud-typeorm";
import { DeepPartial, Repository } from "typeorm";
import { RequestContext } from "nestjs-request-context";
import { snakeCase } from "change-case";
import { IHeader } from "@shared/utils/exporter/types";
import { Entity, ExportDefinition, IHasUserId, InjectEntityExporter, InjectEntityRepository } from "./interface";

export class BaseEntityService<T extends Entity> extends TypeOrmCrudService<T>{
    @InjectEntityExporter private exportDefinition: ExportDefinition;

    constructor(@InjectEntityRepository repo: Repository<T>) {
        super(repo);
    }

    getName(): string {
        return snakeCase(this.entityType.name);
    }

    @Override()
    createOne(req: CrudRequest, dto: DeepPartial<T>): Promise<T> {
        this.insertUserDataBeforeCreate(dto);
        return super.createOne(req, dto);
    }

    @Override()
    createMany(req: CrudRequest, dto: CreateManyDto<DeepPartial<T>>): Promise<T[]> {
        dto.bulk.forEach(item => this.insertUserDataBeforeCreate(item));
        return super.createMany(req, dto);
    }

    async getCount(req: CrudRequest): Promise<{ count: number }> {
        const { parsed, options } = req;
        const builder = await this.createBuilder(parsed, options);
        const count = await builder.getCount();
        return { count };
    }

    insertUserDataBeforeCreate(dto: DeepPartial<T>) {
        if (!this.entityColumns.includes('userId')) {
            return;
        }

        const item = dto as IHasUserId;
        if (item.userId) {
            return dto;
        }

        const user = this.getCurrentUser();
        item.userId = user.id;
    }

    private getCurrentUser() {
        const req = RequestContext.currentContext.req;
        return req.user;
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
}