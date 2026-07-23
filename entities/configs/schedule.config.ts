import { BaseEntityModuleOptions } from '@shared/base-entity/interface';
import { Schedule } from '@shared/entities/Schedule.entity';

/** Full CRUD: users manage their recurring schedules as data. */
function getConfig(): BaseEntityModuleOptions {
  return {
    entity: Schedule,
  };
}

export default getConfig();
