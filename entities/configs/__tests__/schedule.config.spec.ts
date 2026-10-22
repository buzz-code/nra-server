import { BaseEntityService } from '@shared/base-entity/base-entity.service';
import { Schedule } from '@shared/entities/Schedule.entity';
import scheduleConfig from '../schedule.config';

describe('scheduleConfig', () => {
  function makeService() {
    const ServiceClass = scheduleConfig.service as any;
    const repo = { metadata: { columns: [], relations: [], connection: { options: {} } } };
    const scheduleSync = { sync: jest.fn().mockResolvedValue(undefined), isValid: jest.fn().mockReturnValue(true) };
    const service = new ServiceClass(repo, {}, scheduleSync);
    return { service, scheduleSync };
  }

  afterEach(() => jest.restoreAllMocks());

  it('uses the Schedule entity with a custom service', () => {
    expect(scheduleConfig.entity).toBe(Schedule);
    expect(scheduleConfig.service).toBeDefined();
  });

  it.each(['createOne', 'replaceOne'])('%s re-syncs the saved schedule', async (method) => {
    jest.spyOn(BaseEntityService.prototype as any, method).mockResolvedValue({ id: 5 });
    const { service, scheduleSync } = makeService();
    const result = await service[method]({}, { cronExpression: '0 18 * * 5' });
    expect(result).toEqual({ id: 5 });
    expect(scheduleSync.sync).toHaveBeenCalledWith(5);
  });

  it.each(['createOne', 'replaceOne'])('%s rejects an invalid cron before saving', async (method) => {
    const save = jest.spyOn(BaseEntityService.prototype as any, method);
    const { service, scheduleSync } = makeService();
    scheduleSync.isValid.mockReturnValue(false);
    await expect(service[method]({}, { cronExpression: '0 18 * *' })).rejects.toThrow('ביטוי תזמון לא תקין');
    expect(save).not.toHaveBeenCalled();
  });

  it('updateOne re-syncs when a run field changes', async () => {
    jest.spyOn(BaseEntityService.prototype as any, 'updateOne').mockResolvedValue({ id: 5 });
    const { service, scheduleSync } = makeService();
    await service.updateOne({}, { active: false });
    expect(scheduleSync.sync).toHaveBeenCalledWith(5);
  });

  it('updateOne keeps the pending job when only the name changes', async () => {
    jest.spyOn(BaseEntityService.prototype as any, 'updateOne').mockResolvedValue({ id: 5 });
    const { service, scheduleSync } = makeService();
    await service.updateOne({}, { name: 'renamed' });
    expect(scheduleSync.sync).not.toHaveBeenCalled();
  });

  it('updateOne validates a changed time zone against the stored cron', async () => {
    jest.spyOn(BaseEntityService.prototype as any, 'getOne').mockResolvedValue({ id: 5, cronExpression: '0 18 * * 5', timeZone: 'UTC' });
    const update = jest.spyOn(BaseEntityService.prototype as any, 'updateOne');
    const { service, scheduleSync } = makeService();
    scheduleSync.isValid.mockReturnValue(false);
    await expect(service.updateOne({}, { timeZone: 'Not/AZone' })).rejects.toThrow('ביטוי תזמון לא תקין');
    expect(scheduleSync.isValid).toHaveBeenCalledWith({ cronExpression: '0 18 * * 5', timeZone: 'Not/AZone' });
    expect(update).not.toHaveBeenCalled();
  });

  it('createMany re-syncs every created schedule', async () => {
    jest.spyOn(BaseEntityService.prototype, 'createMany').mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
    const { service, scheduleSync } = makeService();
    await service.createMany({}, { bulk: [{ cronExpression: '0 18 * * 5' }] });
    expect(scheduleSync.sync.mock.calls).toEqual([[1], [2]]);
  });

  it('deleteOne re-syncs the deleted id so its pending job is cancelled', async () => {
    jest.spyOn(BaseEntityService.prototype as any, 'deleteOne').mockResolvedValue(undefined);
    const { service, scheduleSync } = makeService();
    await service.deleteOne({ parsed: { paramsFilter: [{ field: 'id', operator: '$eq', value: '7' }] } });
    expect(scheduleSync.sync).toHaveBeenCalledWith(7);
  });
});
