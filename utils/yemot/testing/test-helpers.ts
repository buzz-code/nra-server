/**
 * Test helpers for Yemot scenario testing.
 *
 * Import from '@shared/utils/yemot/testing' in project-specific test files.
 */

/**
 * Use fake timers that only mock Date, leaving all async primitives
 * (setTimeout, setInterval, setImmediate, nextTick, queueMicrotask)
 * untouched so TypeORM/sql.js async initialization keeps working.
 *
 * Call in beforeEach() or at the top of a describe block.
 * Always pair with jest.useRealTimers() in afterEach().
 *
 * Usage:
 *   beforeEach(() => useFakeDateOnly());
 *   afterEach(() => jest.useRealTimers());
 *
 *   it('past deadline', async () => {
 *     jest.setSystemTime(israelTimeAt(9, 0));
 *     // ... handler sees 9:00 AM Israel time
 *   });
 */
export function useFakeDateOnly() {
  jest.useFakeTimers({
    doNotFake: [
      'setTimeout',
      'setInterval',
      'setImmediate',
      'clearTimeout',
      'clearInterval',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
    ],
  });
}
