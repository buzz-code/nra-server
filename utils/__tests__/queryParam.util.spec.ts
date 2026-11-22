import { getAsDate } from '../queryParam.util';

describe('getAsDate', () => {
    it.each([undefined, null, 'undefined', 'null', ''])('returns undefined for empty value %p', (value) => {
        expect(getAsDate(value)).toBeUndefined();
    });

    it('parses a date string', () => {
        expect(getAsDate('2026-11-22')).toEqual(new Date('2026-11-22'));
    });
});
