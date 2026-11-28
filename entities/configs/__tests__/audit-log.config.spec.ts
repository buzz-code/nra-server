import { createAuditLogConfig } from '../audit-log.config';

describe('auditLogConfig revert', () => {
  class Target {}

  function makeService() {
    const ServiceClass = createAuditLogConfig({ Target }).service as any;
    const repo = {
      metadata: { columns: [], relations: [], connection: { options: {} } },
      findBy: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new ServiceClass(repo, {});
    const insert = jest.fn().mockResolvedValue(undefined);
    service.dataSource = { getRepository: jest.fn().mockReturnValue({ insert }) };
    return { service, repo, insert };
  }

  it('reverts only the audit logs the caller can see', async () => {
    const { service, repo, insert } = makeService();
    const ownLog = { id: 1, isReverted: false, entityName: 'Target', operation: 'DELETE', entityId: 10, entityData: { name: 'a' } };
    const getManyByIds = jest.spyOn(service, 'getManyByIds').mockResolvedValue([ownLog]);
    const req = { auth: { id: 5 }, parsed: { extra: { action: 'revert', ids: '1,2' } } };

    const result = await service.doAction(req, {});

    expect(getManyByIds).toHaveBeenCalledWith(req, [1, 2]);
    expect(repo.findBy).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({ name: 'a', id: 10 });
    expect(repo.update).toHaveBeenCalledWith({ id: 1 }, { isReverted: true });
    expect(result).toBe('reverted 1 items, failed 1 items');
  });
});
