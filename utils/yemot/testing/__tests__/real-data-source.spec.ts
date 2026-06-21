import { createRealDataSource } from '../real-data-source';
import { DataSource } from 'typeorm';

describe('createRealDataSource', () => {
  let ds: DataSource;

  afterEach(async () => {
    if (ds && ds.isInitialized) {
      await ds.destroy();
    }
  });

  it('should initialize a real sql.js DataSource', async () => {
    ds = await createRealDataSource();
    expect(ds.isInitialized).toBe(true);
  });

  it('should have User entity available', async () => {
    ds = await createRealDataSource();
    const repo = ds.getRepository('User');
    expect(repo).toBeDefined();
    await repo.save({ id: 1, phoneNumber: '0501234567', name: 'Test' });
    const found = await repo.findOneBy({ id: 1 });
    expect(found).toBeDefined();
    expect(found!.phoneNumber).toBe('0501234567');
  });

  it('should support find with where clause', async () => {
    ds = await createRealDataSource();
    const repo = ds.getRepository('User');
    await repo.save({ id: 1, phoneNumber: '0501111111', name: 'A' });
    await repo.save({ id: 2, phoneNumber: '0502222222', name: 'B' });

    const found = await repo.findOne({ where: { phoneNumber: '0502222222' } });
    expect(found).toBeDefined();
    expect(found!.name).toBe('B');
  });
});
