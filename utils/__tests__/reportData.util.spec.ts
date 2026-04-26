import {
  getNumericValueOrNull,
  calcSum,
  calcAvg,
  roundFractional,
  roundObjectProperty,
  getUniqueValues,
  groupDataByKeys,
  groupDataByKeysAndCalc,
  calcPercents,
  keepBetween,
  getItemById,
} from '../reportData.util';

describe('reportData.util', () => {
  describe('getNumericValueOrNull', () => {
    it('should return null for "null" string', () => {
      expect(getNumericValueOrNull('null')).toBeNull();
    });

    it('should return number for numeric string', () => {
      expect(getNumericValueOrNull('42')).toBe(42);
      expect(getNumericValueOrNull('3.14')).toBe(3.14);
      expect(getNumericValueOrNull('0')).toBe(0);
    });

    it('should return NaN for invalid numeric string', () => {
      expect(getNumericValueOrNull('invalid')).toBeNaN();
    });
  });

  describe('calcSum', () => {
    it('should calculate sum correctly', () => {
      const items = [{ value: 10 }, { value: 20 }, { value: 30 }];
      const result = calcSum(items, item => item.value);
      expect(result).toBe(60);
    });

    it('should handle null values', () => {
      const items = [{ value: 10 }, { value: null }, { value: 30 }];
      const result = calcSum(items, item => item.value);
      expect(result).toBe(40);
    });

    it('should handle empty array', () => {
      const result = calcSum([], item => item.value);
      expect(result).toBe(0);
    });

    it('should handle undefined values', () => {
      const items = [{ value: 10 }, { value: undefined }, { value: 30 }];
      const result = calcSum(items, item => item.value);
      expect(result).toBe(40);
    });
  });

  describe('calcAvg', () => {
    it('should calculate average correctly', () => {
      const items = [{ value: 10 }, { value: 20 }, { value: 30 }];
      const result = calcAvg(items, item => item.value);
      expect(result).toBe(20);
    });

    it('should handle null values by excluding them', () => {
      const items = [{ value: 10 }, { value: null }, { value: 30 }];
      const result = calcAvg(items, item => item.value);
      expect(result).toBe(20);
    });

    it('should handle undefined values by excluding them', () => {
      const items = [{ value: 10 }, { value: undefined }, { value: 30 }];
      const result = calcAvg(items, item => item.value);
      expect(result).toBe(20);
    });

    it('should return 0 for empty array', () => {
      const result = calcAvg([], item => item.value);
      expect(result).toBe(0);
    });

    it('should return 0 when all values are null', () => {
      const items = [{ value: null }, { value: null }];
      const result = calcAvg(items, item => item.value);
      expect(result).toBe(0);
    });
  });

  describe('roundFractional', () => {
    it('should round to 4 decimal places', () => {
      expect(roundFractional(3.14159265)).toBe(3.1416);
      expect(roundFractional(1.23456789)).toBe(1.2346);
      expect(roundFractional(1)).toBe(1);
    });

    it('should handle negative numbers', () => {
      expect(roundFractional(-3.14159265)).toBe(-3.1416);
    });
  });

  describe('roundObjectProperty', () => {
    it('should round property value when it exists', () => {
      const obj = { value: 3.14159265, name: 'test' };
      roundObjectProperty(obj, 'value');
      expect(obj.value).toBe(3.1416);
    });

    it('should not modify when property does not exist', () => {
      const obj = { name: 'test' };
      // @ts-ignore - testing edge case
      roundObjectProperty(obj, 'value');
      expect(obj).toEqual({ name: 'test' });
    });

    it('should not modify when property is null', () => {
      const obj = { value: null, name: 'test' };
      roundObjectProperty(obj, 'value');
      expect(obj.value).toBeNull();
    });

    it('should not modify when property is undefined', () => {
      const obj = { value: undefined, name: 'test' };
      roundObjectProperty(obj, 'value');
      expect(obj.value).toBeUndefined();
    });
  });

  describe('getUniqueValues', () => {
    it('should return unique values', () => {
      const items = [
        { category: 'A' },
        { category: 'B' },
        { category: 'A' },
        { category: 'C' },
        { category: 'B' },
      ];
      const result = getUniqueValues(items, item => item.category);
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('should filter out falsy values', () => {
      const items = [
        { category: 'A' },
        { category: null },
        { category: 'B' },
        { category: undefined },
        { category: '' },
        { category: 'A' },
      ];
      const result = getUniqueValues(items, item => item.category);
      expect(result).toEqual(['A', 'B']);
    });

    it('should handle empty array', () => {
      const result = getUniqueValues([], item => item.category);
      expect(result).toEqual([]);
    });
  });

  describe('groupDataByKeys', () => {
    it('should group data by single key', () => {
      const data = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];
      const result = groupDataByKeys(data, ['category']);
      expect(result).toEqual({
        A: [
          { category: 'A', value: 1 },
          { category: 'A', value: 3 },
        ],
        B: [{ category: 'B', value: 2 }],
      });
    });

    it('should group data by multiple keys', () => {
      const data = [
        { category: 'A', type: 'X', value: 1 },
        { category: 'A', type: 'Y', value: 2 },
        { category: 'A', type: 'X', value: 3 },
      ];
      const result = groupDataByKeys(data, ['category', 'type']);
      expect(result).toEqual({
        'A_X': [
          { category: 'A', type: 'X', value: 1 },
          { category: 'A', type: 'X', value: 3 },
        ],
        'A_Y': [{ category: 'A', type: 'Y', value: 2 }],
      });
    });

    it('should handle empty array', () => {
      const result = groupDataByKeys([], ['category']);
      expect(result).toEqual({});
    });
  });

  describe('groupDataByKeysAndCalc', () => {
    it('should group data and calculate values', () => {
      const data = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];
      const result = groupDataByKeysAndCalc(
        data,
        ['category'],
        items => items.length
      );
      expect(result).toEqual({
        A: 2,
        B: 1,
      });
    });

    it('should handle sum calculation', () => {
      const data = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];
      const result = groupDataByKeysAndCalc(
        data,
        ['category'],
        items => items.reduce((sum, item) => sum + item.value, 0)
      );
      expect(result).toEqual({
        A: 4,
        B: 2,
      });
    });
  });

  describe('calcPercents', () => {
    it('should calculate percentage correctly', () => {
      expect(calcPercents(25, 100)).toBe(25);
      expect(calcPercents(1, 3)).toBe(33);
      expect(calcPercents(2, 3)).toBe(67);
    });

    it('should handle zero total', () => {
      expect(calcPercents(25, 0)).toBe(2500);
    });

    it('should handle zero value', () => {
      expect(calcPercents(0, 100)).toBe(0);
    });
  });

  describe('keepBetween', () => {
    it('should keep value within range', () => {
      expect(keepBetween(5, 1, 10)).toBe(5);
      expect(keepBetween(0, 1, 10)).toBe(1);
      expect(keepBetween(15, 1, 10)).toBe(10);
    });

    it('should handle inverted min/max', () => {
      expect(keepBetween(5, 10, 1)).toBe(5);
      expect(keepBetween(0, 10, 1)).toBe(1);
      expect(keepBetween(15, 10, 1)).toBe(10);
    });

    it('should handle equal min/max', () => {
      expect(keepBetween(5, 3, 3)).toBe(3);
      expect(keepBetween(2, 3, 3)).toBe(3);
    });
  });

  describe('getItemById', () => {
    it('should find item by id', () => {
      const items = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
      ];
      const result = getItemById(items, 2);
      expect(result).toEqual({ id: 2, name: 'B' });
    });

    it('should return undefined when not found', () => {
      const items = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ];
      const result = getItemById(items, 3);
      expect(result).toBeUndefined();
    });

    it('should handle string ids', () => {
      const items = [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ];
      const result = getItemById(items, 'b');
      expect(result).toEqual({ id: 'b', name: 'B' });
    });

    it('should handle empty array', () => {
      const result = getItemById([], 1);
      expect(result).toBeUndefined();
    });
  });
});