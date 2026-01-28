import { BaseEntityModuleOptions } from "@shared/base-entity/interface";
import { IHeader } from "@shared/utils/exporter/types";
import { Text } from "@shared/entities/Text.entity";

function getConfig(): BaseEntityModuleOptions {
    return {
        entity: Text,
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