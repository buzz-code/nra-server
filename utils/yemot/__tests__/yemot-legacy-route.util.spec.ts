import { getYemotLegacyRouteDeadline, isPastYemotLegacyRouteDeadline } from '../yemot-legacy-route.util';

describe('yemot-legacy-route.util', () => {
  const original = process.env.YEMOT_LEGACY_ROUTE_DEADLINE;

  afterEach(() => {
    process.env.YEMOT_LEGACY_ROUTE_DEADLINE = original;
  });

  describe('getYemotLegacyRouteDeadline', () => {
    it('returns null when unset', () => {
      delete process.env.YEMOT_LEGACY_ROUTE_DEADLINE;
      expect(getYemotLegacyRouteDeadline()).toBeNull();
    });

    it('returns null for an unparsable value', () => {
      process.env.YEMOT_LEGACY_ROUTE_DEADLINE = 'not-a-date';
      expect(getYemotLegacyRouteDeadline()).toBeNull();
    });

    it('parses a valid date', () => {
      process.env.YEMOT_LEGACY_ROUTE_DEADLINE = '2030-01-01';
      expect(getYemotLegacyRouteDeadline()).toEqual(new Date('2030-01-01'));
    });
  });

  describe('isPastYemotLegacyRouteDeadline', () => {
    it('is false when unset', () => {
      delete process.env.YEMOT_LEGACY_ROUTE_DEADLINE;
      expect(isPastYemotLegacyRouteDeadline()).toBe(false);
    });

    it('is false before the deadline', () => {
      process.env.YEMOT_LEGACY_ROUTE_DEADLINE = '2999-01-01';
      expect(isPastYemotLegacyRouteDeadline()).toBe(false);
    });

    it('is true after the deadline', () => {
      process.env.YEMOT_LEGACY_ROUTE_DEADLINE = '2000-01-01';
      expect(isPastYemotLegacyRouteDeadline()).toBe(true);
    });
  });
});
