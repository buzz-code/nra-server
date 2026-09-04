import { EntityMetadata } from 'typeorm';
import { UtcTimestampSubscriber } from '../utc-timestamp.subscriber';

describe('UtcTimestampSubscriber', () => {
  let subscriber: UtcTimestampSubscriber;

  beforeEach(() => {
    subscriber = new UtcTimestampSubscriber();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T08:47:55.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const metadataWith = (overrides: Partial<EntityMetadata>) => overrides as EntityMetadata;

  it('stamps createdAt and updatedAt on insert', () => {
    const entity: any = {};
    subscriber.beforeInsert({
      entity,
      metadata: metadataWith({
        createDateColumn: { propertyName: 'createdAt' } as any,
        updateDateColumn: { propertyName: 'updatedAt' } as any,
      }),
    } as any);

    expect(entity.createdAt.toISOString()).toBe('2026-09-04T08:47:55.000Z');
    expect(entity.updatedAt.toISOString()).toBe('2026-09-04T08:47:55.000Z');
  });

  it('stamps only updatedAt on update, leaves createdAt untouched', () => {
    const entity: any = { createdAt: new Date('2020-01-01T00:00:00.000Z') };
    subscriber.beforeUpdate({
      entity,
      metadata: metadataWith({
        createDateColumn: { propertyName: 'createdAt' } as any,
        updateDateColumn: { propertyName: 'updatedAt' } as any,
      }),
    } as any);

    expect(entity.createdAt.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect(entity.updatedAt.toISOString()).toBe('2026-09-04T08:47:55.000Z');
  });

  it('does nothing for entities/metadata without create or update date columns', () => {
    const entity: any = { foo: 'bar' };
    subscriber.beforeInsert({
      entity,
      metadata: metadataWith({}),
    } as any);
    subscriber.beforeUpdate({
      entity,
      metadata: metadataWith({}),
    } as any);

    expect(entity).toEqual({ foo: 'bar' });
  });

  it('is a no-op when the event has no entity (raw query builder ops)', () => {
    expect(() =>
      subscriber.beforeUpdate({
        entity: undefined,
        metadata: metadataWith({ updateDateColumn: { propertyName: 'updatedAt' } as any }),
      } as any),
    ).not.toThrow();
  });
});
