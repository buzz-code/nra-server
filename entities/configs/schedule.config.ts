import { BaseEntityModuleOptions } from '@shared/base-entity/interface';
import { Schedule } from '@shared/entities/Schedule.entity';
import { ScheduleUpdateInterceptor } from '@shared/utils/jobs/schedule-update.interceptor';

/** Full CRUD: users manage their recurring schedules as data. */
function getConfig(): BaseEntityModuleOptions {
  return {
    entity: Schedule,
    routes: {
      updateOneBase: { interceptors: [ScheduleUpdateInterceptor] },
    },
  };
}

export default getConfig();
