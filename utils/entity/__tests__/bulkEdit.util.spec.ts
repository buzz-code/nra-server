import { CrudValidationGroups } from '@dataui/crud';
import { IsNumber, IsOptional, IsPositive, MaxLength } from 'class-validator';
import { getBulkEditFieldsByColumnType, getBulkEditUpdate, validateBulkEditUpdate } from '../bulkEdit.util';

class TestEntity {
  @IsOptional({ groups: [CrudValidationGroups.UPDATE] })
  @IsNumber({}, { always: true })
  @IsPositive({ always: true })
  count: number;

  @IsOptional({ always: true })
  @IsNumber({}, { always: true })
  other: number;

  @MaxLength(5, { always: true })
  comment: string;
}

describe('bulkEdit.util', () => {
  describe('getBulkEditUpdate', () => {
    const fields = { numbers: ['count', 'refId'], dates: ['date'], strings: ['comment'] };

    it('should include only filled fields', () => {
      const update = getBulkEditUpdate(
        { count: '0', refId: 'undefined', date: '2026-10-11', comment: '', other: '5' },
        fields,
      );
      expect(update).toEqual({ count: 0, date: new Date('2026-10-11') });
    });

    it('should skip null and missing fields', () => {
      expect(getBulkEditUpdate({ count: 'null', comment: 'null' }, fields)).toEqual({});
    });

    it('should keep string values', () => {
      expect(getBulkEditUpdate({ comment: 'שלום' }, fields)).toEqual({ comment: 'שלום' });
    });

    it('should throw on invalid number', () => {
      expect(() => getBulkEditUpdate({ count: 'abc' }, fields)).toThrow('ערך לא תקין');
    });

    it('should throw on invalid date', () => {
      expect(() => getBulkEditUpdate({ date: 'abc' }, fields)).toThrow('תאריך לא תקין');
    });

    it('should parse boolean fields', () => {
      expect(getBulkEditUpdate({ active: 'false', other: '' }, { booleans: ['active', 'other'] })).toEqual({ active: false });
    });
  });

  describe('getBulkEditFieldsByColumnType', () => {
    const columnTypes: Record<string, any> = {
      count: 'int',
      refId: Number,
      grade: 'float',
      date: 'date',
      createdAt: Date,
      comment: 'varchar',
      name: String,
      isActive: 'boolean',
      isApproved: Boolean,
    };
    const metadata = {
      name: 'TestEntity',
      findColumnWithPropertyName: (name: string) => (name in columnTypes ? { propertyName: name, type: columnTypes[name] } : undefined),
    } as any;

    it('should group fields by column type', () => {
      expect(getBulkEditFieldsByColumnType(metadata, Object.keys(columnTypes))).toEqual({
        numbers: ['count', 'refId', 'grade'],
        dates: ['date', 'createdAt'],
        strings: ['comment', 'name'],
        booleans: ['isActive', 'isApproved'],
      });
    });

    it('should throw on a field that is not a column', () => {
      expect(() => getBulkEditFieldsByColumnType(metadata, ['missing'])).toThrow('missing');
    });
  });

  describe('validateBulkEditUpdate', () => {
    it('should reject a value the entity rejects on update', async () => {
      await expect(validateBulkEditUpdate(TestEntity, { count: 0 })).rejects.toThrow('count must be a positive number');
      await expect(validateBulkEditUpdate(TestEntity, { count: -1 })).rejects.toThrow('count must be a positive number');
    });

    it('should accept valid values', async () => {
      await expect(validateBulkEditUpdate(TestEntity, { count: 2, other: 0 })).resolves.toBeUndefined();
    });

    it('should not check fields that are not updated', async () => {
      await expect(validateBulkEditUpdate(TestEntity, { other: 0 })).resolves.toBeUndefined();
    });

    it('should skip validation when the target is not a class', async () => {
      await expect(validateBulkEditUpdate('att_report', { count: 0 })).resolves.toBeUndefined();
    });
  });
});
