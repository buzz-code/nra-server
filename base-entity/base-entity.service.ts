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
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MailSendService } from "@shared/utils/mail/mail-send.service";
import { getUserIdFromUser } from "@shared/auth/auth.util";
import { isAdmin } from "@shared/utils/permissionsUtil";
import { getAsNumberArray } from "@shared/utils/queryParam.util";
import { fixTimezoneShift } from "@shared/utils/entity/fixTimezoneShift.util";
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
        if (this.entityColumns.includes(field)) {
            return true;
        }
        const lastDot = field.lastIndexOf('.');
        if (lastDot === -1) {
            return false;
        }
        const relationPath = field.slice(0, lastDot);
        const column = field.slice(lastDot + 1);
        return !!this.getRelationMetadata(relationPath, joinOptions[relationPath])?.allowedColumns.includes(column);
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

    /**
     * Resolves ids to the entities this caller is actually allowed to see - crudAuth's
     * filter (already merged into req.parsed.search by CrudRequestInterceptor) still
     * applies, so an id the caller doesn't own simply isn't returned. For use in custom
     * doAction handlers, which take ids from the request and would otherwise have to
     * re-derive and merge the auth filter themselves to avoid trusting caller-supplied
     * ids across tenants.
     */
    async getManyByIds(req: CrudRequest, ids: any[]): Promise<T[]> {
        if (!ids?.length) {
            return [];
        }
        const idCondition = { id: { $in: ids } };
        const search = req.parsed.search && Object.keys(req.parsed.search).length
            ? { $and: [req.parsed.search, idCondition] }
            : idCondition;
        const builder = await this.createBuilder({ ...req.parsed, search }, req.options);
        return builder.getMany();
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
        if (req.parsed.extra?.action === 'fixTimezoneShift') {
            return this.handleFixTimezoneShiftAction(req);
        }
        return 'done nothing';
    }

    /**
     * Admin-only bulk action: corrects createdAt/updatedAt on the selected
     * rows for entities written before the mysql connection was pinned to
     * UTC (nra-server#44). See fixTimezoneShift.util.ts for the mechanism.
     * getManyByIds both resolves the ids to rows the caller can see (crudAuth)
     * and validates the caller-supplied ids without re-deriving the auth filter.
     */
    private async handleFixTimezoneShiftAction(req: CrudRequest<any, any>): Promise<string> {
        if (!isAdmin(req.auth)) {
            throw new ForbiddenException();
        }
        const ids = getAsNumberArray(req.parsed.extra.ids);
        if (!ids?.length) {
            return 'לא נבחרו רשומות';
        }
        const entities = await this.getManyByIds(req, ids);
        return fixTimezoneShift(this.repo, entities.map((entity: any) => entity.id));
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