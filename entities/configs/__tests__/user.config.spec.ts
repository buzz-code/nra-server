import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import userConfig from '../user.config';

describe('userConfig bulkUpdatePaid', () => {
  function makeService() {
    const ServiceClass = userConfig.service as any;
    const repo = { metadata: { columns: [], relations: [], connection: { options: {} } } };
    const service = new ServiceClass(repo, {});
    const update = jest.fn().mockResolvedValue({ affected: 2 });
    service.dataSource = { getRepository: jest.fn().mockReturnValue({ update }) };
    return { service, update };
  }

  const makeReq = (auth: any) => ({ auth, parsed: { extra: { action: 'bulkUpdatePaid', ids: '1,2', isPaid: 'true' } } });

  it('rejects a non-admin caller without updating', async () => {
    const { service, update } = makeService();
    await expect(service.doAction(makeReq({ id: 5, permissions: {} }), {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('lets an admin update the requested ids', async () => {
    const { service, update } = makeService();
    const result = await service.doAction(makeReq({ id: 1, permissions: { admin: true } }), {});
    expect(update).toHaveBeenCalledWith({ id: In(['1', '2']) }, { isPaid: true });
    expect(result).toBe('עודכנו 2 משתמשים');
  });
});
