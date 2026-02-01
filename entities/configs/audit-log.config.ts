import { BaseEntityModuleOptions, Entity } from '@shared/base-entity/interface';
import { AuditLog } from '@shared/entities/AuditLog.entity';
import { IHeader } from '@shared/utils/exporter/types';
import { getJsonFormatter } from '@shared/utils/formatting/formatter.util';
import { CrudRequest } from '@dataui/crud';
import { BaseEntityService } from '@shared/base-entity/base-entity.service';
import { EntityTarget, In, Repository } from 'typeorm';

export type AuditLogEntityMap = Record<string, EntityTarget<any>>;

export function createAuditLogConfig(entityMap: AuditLogEntityMap = {}): BaseEntityModuleOptions {
  class AuditLogService<T extends Entity | AuditLog> extends BaseEntityService<T> {
    async doAction(req: CrudRequest<any, any>, body: any): Promise<any> {
      switch (req.parsed.extra.action) {
        case 'revert': {
          let successCount = 0;
          const ids = req.parsed.extra.ids.toString().split(',');
          const repo = this.repo as Repository<AuditLog>;
          const auditLogs = await repo.findBy({ id: In(ids) });

          for (const auditLog of auditLogs) {
            try {
              if (!auditLog.isReverted && auditLog.entityName in entityMap) {
                const entityRepo = this.dataSource.getRepository(entityMap[auditLog.entityName]);

                switch (auditLog.operation) {
                  case 'DELETE':
                    await entityRepo.insert({
                      ...auditLog.entityData,
                      id: auditLog.entityId,
                    });
                    break;
                  default:
                    throw new Error(`unknown operation: ${auditLog.operation}`);
                }

                await repo.update({ id: auditLog.id }, { isReverted: true });
              }
              successCount++;
            } catch (e) {
              console.log('AuditLogService.revert: error', e);
            }
          }

          if (successCount === ids.length) {
            return `reverted ${successCount} items`;
          } else {
            return `reverted ${successCount} items, failed ${ids.length - successCount} items`;
          }
        }
      }
      return super.doAction(req, body);
    }
  }

  function getConfig(): BaseEntityModuleOptions {
    return {
      entity: AuditLog,
      exporter: {
        getExportHeaders(): IHeader[] {
          return [
            { value: 'userId', label: 'משתמש' },
            { value: 'entityId', label: 'מזהה שורה' },
            { value: 'entityName', label: 'טבלה' },
            { value: 'operation', label: 'פעולה' },
            { value: getJsonFormatter('entityData'), label: 'המידע שהשתנה' },
            { value: 'createdAt', label: 'תאריך יצירה' },
          ];
        },
      },
      service: AuditLogService,
    };
  }

  return getConfig();
}

export default createAuditLogConfig();
