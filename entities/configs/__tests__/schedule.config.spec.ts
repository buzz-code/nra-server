import { BaseEntityService } from '@shared/base-entity/base-entity.service';
import { Schedule } from '@shared/entities/Schedule.entity';
import scheduleConfig from '../schedule.config';

describe('scheduleConfig', () => {
  function makeService() {
    const ServiceClass = scheduleConfig.service as any;
    const repo = { metadata: { columns: [], relations: [], connection: { options: {} } } };
    const scheduleSync = { sync: jest.fn().mockResolvedValue(undefined) };
    const service = new ServiceClass(repo, {}, scheduleSync);
    return { service, scheduleSync };
  }

  afterEach(() => jest.restoreAllMocks());

  it('uses the Schedule entity with a custom service', () => {
    expect(scheduleConfig.entity).toBe(Schedule);
    expect(scheduleConfig.service).toBeDefined();
  });

  it.each(['createOne', 'updateOne', 'replaceOne'])('%s re-syncs the saved schedule', async (method) => {
    jest.spyOn(BaseEntityService.prototype as any, method).mockResolvedValue({ id: 5 });
    const { service, scheduleSync } = makeService();
    const result = await service[method]({}, {});
    expect(result).toEqual({ id: 5 });
    expect(scheduleSync.sync).toHaveBeenCalledWith(5);
  });

  it('createMany re-syncs every created schedule', async () => {
    jest.spyOn(BaseEntityService.prototype, 'createMany').mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    const { service, scheduleSync } = makeService();
    await service.createMany({}, { bulk: [] });
    expect(scheduleSync.sync.mock.calls).toEqual([[1], [2]]);
  });

  it('deleteOne re-syncs the deleted id so its pending job is cancelled', async () => {
    jest.spyOn(BaseEntityService.prototype as any, 'deleteOne').mockResolvedValue(undefined);
    const { service, scheduleSync } = makeService();
    await service.deleteOne({ parsed: { paramsFilter: [{ field: 'id', operator: '$eq', value: '7' }] } });
    expect(scheduleSync.sync).toHaveBeenCalledWith(7);
  });
});
