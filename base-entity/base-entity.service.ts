import { CreateManyDto, CrudRequest, Override } from "@nestjsx/crud";
import { TypeOrmCrudService } from "@nestjsx/crud-typeorm";
import { DeepPartial } from "typeorm";
import { RequestContext } from "nestjs-request-context";

export interface IHasUserId {
    userId: number;
}

export class BaseEntityService<T extends IHasUserId> extends TypeOrmCrudService<T>{
    constructor(repo) {
        super(repo);
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

}