import { CrudAuthReadOnlyWithPermissionFunc } from "@shared/auth/crud-auth.filter";
import { BaseEntityModuleOptions } from "@shared/base-entity/interface";
import { Page } from "@shared/entities/Page.entity";

function getConfig(): BaseEntityModuleOptions {
    return {
        entity: Page,
        crudAuth: CrudAuthReadOnlyWithPermissionFunc(permissions => permissions.editPagesData),
    }
}

export default getConfig();