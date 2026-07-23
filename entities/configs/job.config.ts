import { BaseEntityModuleOptions } from '@shared/base-entity/interface';
import { Job } from '@shared/entities/Job.entity';

/** Read-only monitor screen: jobs are created by code, not by users. */
function getConfig(): BaseEntityModuleOptions {
  return {
    entity: Job,
    query: {
      join: {
        user: { eager: false },
      },
    },
    routes: {
      only: ['getManyBase', 'getOneBase'],
    },
  };
}

export default getConfig();
