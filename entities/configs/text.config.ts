import { BaseEntityModuleOptions } from "@shared/base-entity/interface";
import { IHeader } from "@shared/utils/exporter/types";
import { Text } from "@shared/entities/Text.entity";
import { TextCacheInvalidateInterceptor } from "@shared/utils/text/text-cache-invalidate.interceptor";

function getConfig(): BaseEntityModuleOptions {
    return {
        entity: Text,
        routes: {
            createOneBase: { interceptors: [TextCacheInvalidateInterceptor] },
            updateOneBase: { interceptors: [TextCacheInvalidateInterceptor] },
            deleteOneBase: { interceptors: [TextCacheInvalidateInterceptor] },
        },
        exporter: {
            getExportHeaders(): IHeader[] {
                return [
                    { value: 'name', label: 'מזהה' },
                    { value: 'description', label: 'תיאור' },
                    { value: 'value', label: 'ערך' },
                ];
            }
        },
    }
}

export default getConfig();