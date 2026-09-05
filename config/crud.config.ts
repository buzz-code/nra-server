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
});

export const CrudConfig = {};