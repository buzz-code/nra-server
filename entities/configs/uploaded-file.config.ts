import { BaseEntityModuleOptions } from '@shared/base-entity/interface';
import { IHeader } from '@shared/utils/exporter/types';
import { UploadedFile } from '@shared/entities/UploadedFile.entity';
import { CrudAuthWithPermissionsFilter } from "@shared/auth/crud-auth.filter";

function getConfig(): BaseEntityModuleOptions {
  return {
    entity: UploadedFile,
    crudAuth: CrudAuthWithPermissionsFilter(permissions => permissions?.uploadedFiles),
    exporter: {
      getExportHeaders(): IHeader[] {
        return [
          { value: 'id', label: 'מזהה' },
          { value: 'title', label: 'כותרת' },
          { value: 'description', label: 'תיאור' },
          { value: 'createdAt', label: 'תאריך יצירה' },
          { value: 'updatedAt', label: 'תאריך עדכון' },
        ];
      },
    },
  };
}

export default getConfig();
