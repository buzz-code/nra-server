import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';

/**
 * @CreateDateColumn/@UpdateDateColumn (CreatedAtColumn/UpdatedAtColumn in
 * column-types.util.ts) rely on MySQL's own DEFAULT CURRENT_TIMESTAMP /
 * ON UPDATE CURRENT_TIMESTAMP when the app doesn't provide an explicit
 * value - and CURRENT_TIMESTAMP() is evaluated by the MySQL *server*
 * using its SESSION time_zone. That's a completely separate mechanism
 * from mysql2's `timezone` connection option (database.config.ts
 * `timezone: 'Z'`), which only affects how the driver serializes/parses
 * JS Date <-> SQL string - it has no effect on this at all. See
 * typeorm/typeorm#8054, #8296, #2939: "the timezone connection option
 * does not make any difference for this problem."
 *
 * When the MySQL server's session time_zone isn't UTC (e.g. a shared
 * instance whose SYSTEM zone is a consuming app's own local time - not
 * something we can just flip without affecting other tenants on it),
 * CURRENT_TIMESTAMP() returns that non-UTC wall-clock reading, which
 * then gets stored and read back as-is.
 *
 * Fix: never let MySQL compute these itself. Always stamp an explicit,
 * JS-computed Date right before persistence, so mysql2 serializes it
 * using UTC getters (timezone: 'Z') and it's sent as an explicit
 * INSERT/UPDATE value - bypassing the DB-side default entirely. (A
 * MySQL TIMESTAMP column still applies its own session-time_zone
 * conversion to that explicit value on the way in and back out, but
 * that round-trips correctly as long as the read goes through the same
 * session's time_zone as the write - true for this app's own pooled
 * connections.)
 *
 * Only applies to entity-based persistence (repository.save/insert) -
 * a raw QueryBuilder .update() bypasses subscribers entirely, same as
 * it already bypasses @UpdateDateColumn's own auto-stamp.
 */
@EventSubscriber()
export class UtcTimestampSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<any>) {
    this.stamp(event.entity, event.metadata, true);
  }

  beforeUpdate(event: UpdateEvent<any>) {
    this.stamp(event.entity, event.metadata, false);
  }

  private stamp(entity: any, metadata: InsertEvent<any>['metadata'], isInsert: boolean) {
    if (!entity) return;
    const now = new Date();
    if (isInsert && metadata.createDateColumn) {
      entity[metadata.createDateColumn.propertyName] = now;
    }
    if (metadata.updateDateColumn) {
      entity[metadata.updateDateColumn.propertyName] = now;
    }
  }
}
