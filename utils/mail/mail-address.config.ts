import { BaseEntityModuleOptions } from "@shared/base-entity/interface";
import { MailAddressUpdateInterceptor } from "@shared/utils/mail/mail-address-update.interceptor";
import { MailAddress } from "@shared/entities/MailAddress.entity";
import { MailAddressDeleteInterceptor } from "./mail-address-delete.interceptor";

function getConfig(): BaseEntityModuleOptions {
    return {
        entity: MailAddress,
        routes: {
            updateOneBase: { interceptors: [MailAddressUpdateInterceptor] },
            createOneBase: { interceptors: [MailAddressUpdateInterceptor] },
            deleteOneBase: { interceptors: [MailAddressDeleteInterceptor] },
        }
    }
}

export default getConfig();