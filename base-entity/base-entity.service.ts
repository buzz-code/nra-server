import { CreateManyDto, CrudRequest, Override } from "@dataui/crud";
import { TypeOrmCrudService } from "@dataui/crud-typeorm";
import { DeepPartial } from "typeorm";
import { RequestContext } from "nestjs-request-context";
import { snakeCase } from "change-case";
import { IHeader } from "@shared/exporter/types";

export interface IHasUserId {
    userId: number;
}

export class BaseEntityService<T extends IHasUserId> extends TypeOrmCrudService<T>{
    constructor(repo) {
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
        if (dto.userId) {
            return dto;
        }

        const user = this.getCurrentUser();
        dto.userId = user.id;
    }

    private getCurrentUser() {
        const req = RequestContext.currentContext.req;
        return req.user;
    }

    async getDataForExport(req: CrudRequest): Promise<any[]> {
        const data = await this.getMany(req);
        return Array.isArray(data) ? data : data.data;
    }

    getExportHeaders(): IHeader[] {
        return this.entityColumns;
    }
}