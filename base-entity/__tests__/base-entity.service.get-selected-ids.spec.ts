import { CrudRequest } from '@dataui/crud';
import { DataSource } from 'typeorm';
import { createRealDataSource } from '@shared/utils/yemot/testing/real-data-source';
import { BaseEntityService } from '../base-entity.service';

describe('BaseEntityService.getSelectedIds (real sqlite)', () => {
  let ds: DataSource;
  let service: BaseEntityService<any>;

  const reqFor = (ids: string, search: object = {}) =>
    ({
      auth: {},
      parsed: {
        fields: [], paramsFilter: [], authPersist: [], search, filter: [], or: [], join: [],
        sort: [], limit: 0, offset: 0, page: 1, cache: 0, includeDeleted: 0, extra: { ids },
      },
      options: { query: {}, params: {}, routes: {} },
    }) as unknown as CrudRequest<any, any>;

  beforeEach(async () => {
    ds = await createRealDataSource();
    const repo = ds.getRepository('User');
    await repo.save([
      { id: 1, name: 'mine', phoneNumber: '1' },
      { id: 2, name: 'mine', phoneNumber: '2' },
      { id: 3, name: 'other', phoneNumber: '3' },
    ]);
    service = new BaseEntityService(repo as any, null);
  });

  afterEach(() => ds.destroy());

  it('returns the requested ids that exist', async () => {
    expect((await service.getSelectedIds(reqFor('1,2,3,99'))).sort()).toEqual([1, 2, 3]);
  });

  it('applies the auth search filter, dropping ids the caller cannot see', async () => {
    expect((await service.getSelectedIds(reqFor('1,2,3', { name: 'mine' }))).sort()).toEqual([1, 2]);
  });

  it('returns [] for no ids', async () => {
    expect(await service.getSelectedIds(reqFor(''))).toEqual([]);
  });
});
