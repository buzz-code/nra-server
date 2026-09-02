import { In, Repository } from 'typeorm';

const TIMESTAMP_COLUMNS = ['createdAt', 'updatedAt'];

/**
 * Recovers the correct UTC instant for a Date that was stored under the
 * mysql2 `timezone: 'local'` bug (nra-server#44): before the connection was
 * pinned to UTC, TypeORM handed mysql2 a raw Date object for `timestamp`/
 * `datetime` columns, and mysql2 serialized/parsed it using the server
 * process's *local* getters instead of UTC getters. So a Date representing
 * e.g. 10:24 Israel time got written using its Israel-local wall-clock
 * digits ("10:24"), which MySQL then stored/returned as if those digits
 * were already UTC.
 *
 * This reverses that: it takes the given Date's UTC-getter digits (the
 * Israel-local wall-clock reading they actually were) and resolves the true
 * UTC instant those digits denote, DST-aware, via Intl.
 */
export function reinterpretUtcDigitsAsIsraelLocal(wrongDate: Date): Date {
  const y = wrongDate.getUTCFullYear();
  const mo = wrongDate.getUTCMonth();
  const d = wrongDate.getUTCDate();
  const h = wrongDate.getUTCHours();
  const mi = wrongDate.getUTCMinutes();
  const s = wrongDate.getUTCSeconds();
  const ms = wrongDate.getUTCMilliseconds();
  const targetLocalDigitsAsUtcMillis = Date.UTC(y, mo, d, h, mi, s, ms);

  // The Israel/UTC offset only takes two values (standard time / DST), so this
  // converges within a couple of passes - except during the one hour a year
  // the DST "fall back" reading is ambiguous, an acceptable approximation for
  // a one-off remediation tool.
  let guess = targetLocalDigitsAsUtcMillis;
  for (let i = 0; i < 3; i++) {
    const offsetMinutes = getTimeZoneOffsetMinutes('Asia/Jerusalem', new Date(guess));
    guess = targetLocalDigitsAsUtcMillis - offsetMinutes * 60_000;
  }
  return new Date(guess);
}

function getTimeZoneOffsetMinutes(timeZone: string, at: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(at).map((p) => [p.type, p.value]));
  const localDigitsAsUtcMillis = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  // formatToParts only has whole-second precision, so the raw diff carries up to
  // ~1s of noise from `at`'s sub-second component. A real timezone offset is
  // always a whole number of minutes, so round it away.
  return Math.round((localDigitsAsUtcMillis - at.getTime()) / 60_000);
}

/**
 * Bulk-corrects createdAt/updatedAt on the given rows, for rows written
 * before nra-server#44 (mysql connection pinned to UTC). Writes the
 * corrected values through a raw UPDATE query, bypassing @UpdateDateColumn's
 * auto-stamp-on-save behavior, so the corrected value actually sticks.
 */
export async function fixTimezoneShift(repository: Repository<any>, ids: number[]): Promise<string> {
  if (!ids?.length) {
    return 'לא נבחרו רשומות';
  }

  const dateColumns = repository.metadata.columns
    .map((column) => column.propertyName)
    .filter((name) => TIMESTAMP_COLUMNS.includes(name));
  if (!dateColumns.length) {
    return 'אין עמודות תאריך לתיקון בטבלה זו';
  }

  const rows = await repository.find({
    where: { id: In(ids) } as any,
    select: ['id', ...dateColumns] as any,
  });

  let fixedCount = 0;
  for (const row of rows) {
    const updates: Record<string, Date> = {};
    for (const column of dateColumns) {
      const current = (row as any)[column];
      if (current instanceof Date && !isNaN(current.getTime())) {
        updates[column] = reinterpretUtcDigitsAsIsraelLocal(current);
      }
    }
    if (Object.keys(updates).length) {
      await repository
        .createQueryBuilder()
        .update()
        .set(updates)
        .where('id = :id', { id: (row as any).id })
        .execute();
      fixedCount++;
    }
  }

  return `תוקנו ${fixedCount} רשומות`;
}
