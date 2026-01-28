import { CrudAuthWithPermissionsFilter } from "@shared/auth/crud-auth.filter";
import { BaseEntityModuleOptions, Entity } from "@shared/base-entity/interface";
import { User } from "src/db/entities/User.entity";
import { BaseEntityService } from "@shared/base-entity/base-entity.service";
import { CrudRequest } from "@dataui/crud";
import { In } from "typeorm";
import { getAsArray, getAsBoolean } from "@shared/utils/queryParam.util";

function getConfig(): BaseEntityModuleOptions {
    return {
        entity: User,
        crudAuth: CrudAuthWithPermissionsFilter(permissions => permissions.showUsersData),
        service: UserService,
    }
}

class UserService<T extends Entity | User> extends BaseEntityService<T> {
    async doAction(req: CrudRequest<any, any>, body: any): Promise<any> {
        switch (req.parsed.extra.action) {
            case 'bulkUpdatePaid': {
                const ids = getAsArray(req.parsed.extra.ids);
                const isPaid = getAsBoolean(req.parsed.extra.isPaid) ?? false;
                if (!ids) return 'לא נבחרו רשומות';

                const result = await this.dataSource.getRepository(User).update(
                    { id: In(ids) },
                    { isPaid }
                );

                return `עודכנו ${result.affected} משתמשים`;
            }
        }
        return super.doAction(req, body);
    }
}

export default getConfig();