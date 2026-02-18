import { CrudAuthWithPermissionsFilter } from "@shared/auth/crud-auth.filter";
import { BaseEntityModuleOptions } from "@shared/base-entity/interface";
import { IHeader } from "@shared/utils/exporter/types";
import { PhoneTemplate } from "@shared/entities/PhoneTemplate.entity";

function getConfig(): BaseEntityModuleOptions {
  return {
    entity: PhoneTemplate,
    crudAuth: CrudAuthWithPermissionsFilter(permissions => permissions.phoneCampaign),
    exporter: {
      getExportHeaders(): IHeader[] {
        return [
          { value: 'id', label: 'מזהה' },
          { value: 'name', label: 'שם תבנית' },
          { value: 'message', label: 'הודעה' },
          { value: 'createdAt', label: 'תאריך יצירה' },
        ];
      }
    },
  };
}

export default getConfig();
