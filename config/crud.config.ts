import { CrudConfigService } from '@dataui/crud';
import { AuditLogInterceptor } from '@shared/base-entity/audit-log.interceptor';

CrudConfigService.load({
    auth: {
        property: 'user'
    },
    routes: {
        deleteOneBase: {
            interceptors: [AuditLogInterceptor],
            returnDeleted: true,
        },
    },
    //   query: {
    //     limit: 25,
    //     cache: 2000,
    //   },
    // params: {
    //     id: {
    //         field: 'id',
    //         type: 'number',
    //         primary: true,
    //     },
    // },
});

export const CrudConfig = {};