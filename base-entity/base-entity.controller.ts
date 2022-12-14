import { Get, UseInterceptors } from "@nestjs/common";
import { CrudController, CrudRequest, CrudRequestInterceptor, ParsedRequest } from "@nestjsx/crud";
import { BaseEntityService, IHasUserId } from "./base-entity.service";

export class BaseEntityController<T extends IHasUserId> implements CrudController<T> {
    constructor(public service: BaseEntityService<T>) { }

    @Get('/get-count')
    @UseInterceptors(CrudRequestInterceptor)
    getCount(@ParsedRequest() req: CrudRequest) {
        return this.service.getCount(req);
    }
}
