import { CrudAuthReadOnlyWithPermissionFunc } from "@shared/auth/crud-auth.filter";
import { BaseEntityModuleOptions } from "@shared/base-entity/interface";
import { PaymentTrack } from "@shared/entities/PaymentTrack.entity";

function getConfig(): BaseEntityModuleOptions {
    return {
        entity: PaymentTrack,
        crudAuth: CrudAuthReadOnlyWithPermissionFunc(permissions => permissions.editPaymentTracksData),
    }
}

export default getConfig();