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

    private static readonly DATE_COLUMN_TYPES = new Set(['date', 'datetime', 'timestamp']);
    private static readonly NUMERIC_COLUMN_TYPES = new Set(['int', 'integer', 'tinyint', 'smallint', 'mediumint', 'bigint', 'decimal', 'numeric', 'float', 'double', 'real']);
    private static readonly DATE_VALUE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?$/;
    private static readonly NUMERIC_VALUE_PATTERN = /^-?\d+(\.\d+)?$/;

    private assertValidFieldValues(conditions: CrudRequest<any, any>['parsed']['filter'] = [], joinOptions: JoinOptions = {}): void {
        for (const condition of conditions) {
            const column = this.findFilterColumn(condition?.field, joinOptions);
            if (column) {
                this.assertValidFilterValue(condition, column);
            }
        }
    }

    private assertValidFilterValue(condition: { field: string; operator: string; value?: any }, column: { type?: unknown }): void {
        const columnType = this.getColumnTypeName(column);
        const kind = BaseEntityService.DATE_COLUMN_TYPES.has(columnType)
            ? 'date'
            : BaseEntityService.NUMERIC_COLUMN_TYPES.has(columnType)
                ? 'numeric'
                : undefined;
        if (!kind) {
            return;
        }
        const { field, operator, value } = condition;
        if (value === null || value === undefined || ((operator === '$is' || operator === '$not') && typeof value === 'boolean')) {
            return;
        }
        const allowBoolean = kind === 'numeric' && columnType === 'tinyint';
        const values = Array.isArray(value) ? value : [value];
        for (const item of values) {
            if (!this.isValidTypedValue(item, kind, allowBoolean)) {
                throw new BadRequestException(`Invalid value for ${kind} field ${field}: ${String(item)}`);
            }
        }
    }

    private findFilterColumn(field: string, joinOptions: JoinOptions = {}): { type?: unknown } | undefined {
        if (!field) {
            return undefined;
        }
        if (this.entityColumns.includes(field)) {
            return this.repo.metadata.columns.find((col: any) => col.propertyPath === field || col.propertyName === field);
        }
        const lastDot = field.lastIndexOf('.');
        if (lastDot === -1) {
            return undefined;
        }
        const relationPath = field.slice(0, lastDot);
        const column = field.slice(lastDot + 1);
        const relation = this.getRelationMetadata(relationPath, joinOptions[relationPath]);
        if (!relation?.allowedColumns.includes(column)) {
            return undefined;
        }
        return this.getRelationColumnMetadata(relationPath, column);
    }

    private getRelationColumnMetadata(relationPath: string, propertyName: string): { type?: unknown } | undefined {
        let metadata: any = this.repo.metadata;
        for (const relationName of relationPath.split('.')) {
            const relation = metadata?.relations?.find((one: any) => one.propertyName === relationName);
            metadata = relation?.inverseEntityMetadata;
        }
        return metadata?.columns?.find((col: any) => col.propertyPath === propertyName || col.propertyName === propertyName);
    }

    private getColumnTypeName(column: { type?: unknown }): string {
        const type = typeof column?.type === 'function' ? (column.type as () => string).name : column?.type;
        return String(type ?? '').toLowerCase();
    }

    private isValidTypedValue(value: any, kind: 'date' | 'numeric', allowBoolean: boolean): boolean {
        if (value === null || value === undefined) {
            return true;
        }
        if (kind === 'date') {
            return this.isValidDateValue(value);
        }
        return this.isValidNumericValue(value, allowBoolean);
    }

    private isValidDateValue(value: any): boolean {
        if (value instanceof Date) {
            return !Number.isNaN(value.getTime());
        }
        const match = typeof value === 'string' ? value.match(BaseEntityService.DATE_VALUE_PATTERN) : undefined;
        if (!match) {
            return false;
        }
        const [year, month, day] = match[1].split('-').map(Number);
        const asUtc = new Date(Date.UTC(year, month - 1, day));
        if (asUtc.getUTCFullYear() !== year || asUtc.getUTCMonth() !== month - 1 || asUtc.getUTCDate() !== day) {
            return false;
        }
        if (match[2]) {
            const [hour, minute, second] = match[2].split(':').map(Number);
            if (hour > 23 || minute > 59 || second > 59) {
                return false;
            }
        }
        return true;
    }

    private isValidNumericValue(value: any, allowBoolean: boolean): boolean {
        if (allowBoolean && typeof value === 'boolean') {
            return true;
        }
        if (typeof value === 'number') {
            return Number.isFinite(value);
        }
        return typeof value === 'string' && BaseEntityService.NUMERIC_VALUE_PATTERN.test(value);
    }

    protected getSort(query: ParsedRequestParams, options: QueryOptions): ObjectLiteral {
        this.assertValidFields((query.sort ?? []).map((s) => s.field), options.join);
        return super.getSort(query, options);
    }

    async createBuilder(parsed: ParsedRequestParams, options: CrudRequestOptions, many = true, withDeleted = false): Promise<SelectQueryBuilder<T>> {
        const filterConditions = [...(parsed.filter ?? []), ...(parsed.or ?? [])];
        this.assertValidFields(filterConditions.map((f) => f.field), options.query.join);
        this.assertValidFieldValues(filterConditions, options.query.join);
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