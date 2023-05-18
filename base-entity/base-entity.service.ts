import { CreateManyDto, CrudRequest, GetManyDefaultResponse, Override } from "@dataui/crud";
import { TypeOrmCrudService } from "@dataui/crud-typeorm";
import { DataSource, DeepPartial, EntityManager, Repository } from "typeorm";
import { snakeCase } from "change-case";
import { IHeader } from "@shared/utils/exporter/types";
import { Entity, ExportDefinition, IHasUserId, InjectEntityExporter, InjectEntityRepository } from "./interface";
import { ParamsToJsonReportGenerator } from "@shared/utils/report/report.generators";
import { CommonReportData } from "@shared/utils/report/types";
import { InjectDataSource } from "@nestjs/typeorm";
import { MailSendService } from "@shared/utils/mail/mail-send.service";

export class BaseEntityService<T extends Entity> extends TypeOrmCrudService<T>{
    @InjectEntityExporter private exportDefinition: ExportDefinition;
    @InjectDataSource() public dataSource: DataSource;

    constructor(@InjectEntityRepository repo: Repository<T>,
        public mailSendService: MailSendService) {
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
        this.insertUserDataBeforeCreate(dto, req.auth?.id);
        return super.createOne(req, dto);
    }

    @Override()
    createMany(req: CrudRequest<any>, dto: CreateManyDto<DeepPartial<T>>): Promise<T[]> {
        dto.bulk.forEach(item => this.insertUserDataBeforeCreate(item, req.auth?.id));
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
        const columns = this.entityColumns.filter(item => !['id', 'userId', 'createdAt', 'updatedAt'].includes(item));
        if (this.exportDefinition?.getImportFields) {
            return this.exportDefinition.getImportFields(columns);
        } else {
            return columns;
        }
    }

    async getReportData(req: CrudRequest): Promise<CommonReportData> {
        const name = this.getName() + '-extra';
        const generator = new ParamsToJsonReportGenerator(() => name);
        return {
            generator,
            params: req.parsed.extra,
        }
    }

    async doAction(req: CrudRequest<any, any>): Promise<any> {
        return 'done nothing';
    }

    async getPivotData(req: CrudRequest<any, any>): Promise<GetManyDefaultResponse<T> | T[]> {
        const res = await this.getMany(req);
        const list = Array.isArray(res) ? res : res.data;
        if (list.length > 0) {
            const pivotName = req.parsed.extra.pivot?.replace('?', '');
            await this.populatePivotData(pivotName, list);
        }
        return res;
    }

    protected async populatePivotData(pivotName: string, data: T[]): Promise<void> {
        //override this
    }
}