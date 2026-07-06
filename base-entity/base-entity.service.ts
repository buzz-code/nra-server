import { CreateManyDto, CrudRequest, CrudRequestOptions, GetManyDefaultResponse, JoinOptions, Override, QueryOptions } from "@dataui/crud";
import { ParsedRequestParams } from "@dataui/crud-request";
import { TypeOrmCrudService } from "@dataui/crud-typeorm";
import { DataSource, DeepPartial, EntityManager, ObjectLiteral, Repository, SelectQueryBuilder } from "typeorm";
import { snakeCase } from "change-case";
import { IHeader } from "@shared/utils/exporter/types";
import { Entity, ExportDefinition, ImportDefinition, IHasUserId, InjectEntityExporter, InjectEntityRepository } from "./interface";
import { ParamsToJsonReportGenerator } from "@shared/utils/report/params-to-json.generator";
import { CommonReportData } from "@shared/utils/report/types";
import { InjectDataSource } from "@nestjs/typeorm";
import { BadRequestException } from "@nestjs/common";
import { MailSendService } from "@shared/utils/mail/mail-send.service";
import { getUserIdFromUser } from "@shared/auth/auth.util";
import { validateNotTrialEnded } from "./base-entity.util";

export class BaseEntityService<T extends Entity> extends TypeOrmCrudService<T> {
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

    getExportName(req?: CrudRequest, data?: any[]): string {
        return this.getName();
    }

    @Override()
    async createOne(req: CrudRequest<any>, dto: DeepPartial<T>): Promise<T> {
        await validateNotTrialEnded(req.auth, this.dataSource);
        this.insertUserDataBeforeCreate(dto, getUserIdFromUser(req.auth));
        return super.createOne(req, dto);
    }

    @Override()
    async createMany(req: CrudRequest<any>, dto: CreateManyDto<DeepPartial<T>>): Promise<T[]> {
        await validateNotTrialEnded(req.auth, this.dataSource);
        const userId = getUserIdFromUser(req.auth);
        dto.bulk.forEach(item => this.insertUserDataBeforeCreate(item, userId));
        return super.createMany(req, dto);
    }

    private isValidField(field: string, joinOptions: JoinOptions): boolean {
        const dotIndex = field.indexOf('.');
        if (dotIndex === -1) {
            return this.entityColumns.includes(field);
        }
        const relationName = field.slice(0, dotIndex);
        const column = field.slice(dotIndex + 1);
        if (!joinOptions[relationName]) {
            return false;
        }
        const relation = this.repo.metadata.findRelationWithPropertyPath(relationName);
        return !!relation?.inverseEntityMetadata.columns.some((c) => c.propertyPath === column);
    }

    private assertValidFields(fields: string[], joinOptions: JoinOptions = {}): void {
        const invalidField = fields.find((field) => !this.isValidField(field, joinOptions));
        if (invalidField) {
            throw new BadRequestException(`Invalid field: ${invalidField}`);
        }
    }

    protected getSort(query: ParsedRequestParams, options: QueryOptions): ObjectLiteral {
        this.assertValidFields((query.sort ?? []).map((s) => s.field), options.join);
        return super.getSort(query, options);
    }

    async createBuilder(parsed: ParsedRequestParams, options: CrudRequestOptions, many = true, withDeleted = false): Promise<SelectQueryBuilder<T>> {
        this.assertValidFields([...(parsed.filter ?? []), ...(parsed.or ?? [])].map((f) => f.field), options.query.join);
        return super.createBuilder(parsed, options, many, withDeleted);
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
        item.userId ??= userId;
    }
    async getDataForExport(req: CrudRequest): Promise<any[]> {
        if (this.exportDefinition?.processReqForExport) {
            return this.exportDefinition.processReqForExport(req, this.getDataForExportInner.bind(this));
        } else {
            return this.getDataForExportInner(req);
        }
    }

    private async getDataForExportInner(req: CrudRequest<any, any>): Promise<T[]> {
        let data;
        if (req.parsed.extra?.pivot) {
            data = await this.getPivotData(req);
        } else {
            data = await this.getMany(req);
        }
        return Array.isArray(data) ? data : data.data;
    }

    getExportHeaders(req: CrudRequest<any, any>, data: any[]): IHeader[] {
        let headers: IHeader[];
        if (this.exportDefinition?.getExportHeaders) {
            headers = this.exportDefinition.getExportHeaders(this.entityColumns, req, data);
        } else {
            headers = this.entityColumns;
        }

        if (req.parsed.extra?.pivot && data.length) {
            headers = [
                ...headers,
                ...(data[0].headers ?? []),
            ];
        }

        return headers;
    }

    getImportDefinition(): ImportDefinition {
        const importFields = this.entityColumns.filter(item => !['id', 'userId', 'createdAt', 'updatedAt'].includes(item));
        return this.exportDefinition?.getImportDefinition?.(importFields) ?? { importFields };
    }

    async getReportData(req: CrudRequest): Promise<CommonReportData> {
        const name = this.getName() + '-extra';
        const generator = new ParamsToJsonReportGenerator(() => name);
        return {
            generator,
            params: req.parsed.extra,
        }
    }

    async doAction(req: CrudRequest<any, any>, body: any): Promise<any> {
        return 'done nothing';
    }

    async getPivotData(req: CrudRequest<any, any>): Promise<GetManyDefaultResponse<T> | T[]> {
        const res = await this.getMany(req);
        const list = Array.isArray(res) ? res : res.data;
        if (list.length > 0) {
            const pivotName = req.parsed.extra?.pivot?.replace('?', '');
            await this.populatePivotData(pivotName, list, req.parsed.extra, req.parsed.filter, req.auth);
        }
        return res;
    }

    protected async populatePivotData(pivotName: string, data: T[], extra: any, filter: CrudRequest<any, any>['parsed']['filter'], auth: any) {
        //override this
    }
}