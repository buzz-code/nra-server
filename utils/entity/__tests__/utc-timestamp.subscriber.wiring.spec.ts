import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { CreatedAtColumn, UpdatedAtColumn } from '../column-types.util';

/**
 * Regression test for the actual bug we shipped once: registering
 * UtcTimestampSubscriber as a NestJS provider (base-app.module.ts) looked
 * right and passed every unit test, but TypeORM never learned about it -
 * a subscriber only takes effect once it's listed in
 * DataSourceOptions.subscribers (database.config.ts). This test exercises
 * the *real* exported `databaseConfig`, through a real DataSource and a
 * real repository.save(), so a future regression (subscriber dropped from
 * database.config.ts, wiring broken some other way) fails here instead of
 * silently shipping.
 */
process.env.NODE_ENV = 'test';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { databaseConfig } = require('../../../config/database.config');

@Entity()
class WiringProbeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @CreatedAtColumn()
  createdAt: Date;

  @UpdatedAtColumn()
  updatedAt: Date;
}

describe('UtcTimestampSubscriber wiring (via the real exported databaseConfig)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      ...databaseConfig,
      entities: [WiringProbeEntity],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('registers UtcTimestampSubscriber on the real databaseConfig', () => {
    const names = dataSource.subscribers.map((s) => s.constructor.name);
    expect(names).toContain('UtcTimestampSubscriber');
  });

  it('stamps createdAt/updatedAt on a real repository.save()', async () => {
    const repo = dataSource.getRepository(WiringProbeEntity);
    const before = Date.now();
    const saved = await repo.save({ name: 'probe' });
    const after = Date.now();

    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(saved.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(saved.createdAt.getTime()).toBeLessThanOrEqual(after);
  });
});
