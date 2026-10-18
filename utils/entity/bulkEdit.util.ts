import { BadRequestException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { getAsBoolean, getAsDate, getAsNumber, getAsString } from '@shared/utils/queryParam.util';

interface BulkEditFields {
  numbers?: string[];
  dates?: string[];
  strings?: string[];
  booleans?: string[];
}

const numberTypes = ['int', 'integer', 'tinyint', 'smallint', 'mediumint', 'bigint', 'float', 'double', 'decimal', 'number'];
const dateTypes = ['date', 'datetime', 'timestamp'];
const booleanTypes = ['boolean', 'bool'];

function isEmptyParam(value: string | undefined): boolean {
  return value === undefined || value === 'undefined' || value === 'null' || value === '';
}

/**
 * Builds a partial update from bulk action params, skipping fields left empty.
 * Throws on a value that is not a valid number or date.
 */
export function getBulkEditUpdate(extra: Record<string, string>, fields: BulkEditFields): Record<string, any> {
  const update: Record<string, any> = {};
  for (const field of fields.numbers ?? []) {
    if (isEmptyParam(extra[field])) continue;
    const value = getAsNumber(extra[field]);
    if (isNaN(value)) throw new BadRequestException('ערך לא תקין');
    update[field] = value;
  }
  for (const field of fields.dates ?? []) {
    if (isEmptyParam(extra[field])) continue;
    const value = getAsDate(extra[field]);
    if (isNaN(value.getTime())) throw new BadRequestException('תאריך לא תקין');
    update[field] = value;
  }
  for (const field of fields.strings ?? []) {
    if (isEmptyParam(extra[field])) continue;
    update[field] = getAsString(extra[field]);
  }
  for (const field of fields.booleans ?? []) {
    if (isEmptyParam(extra[field])) continue;
    update[field] = getAsBoolean(extra[field]);
  }
  return update;
}

/**
 * Groups the allowed bulk edit fields by their column type, read from the entity metadata.
 * Throws when a field is not a column of the entity, so a typo in a config fails loudly.
 */
export function getBulkEditFieldsByColumnType(metadata: EntityMetadata, fieldNames: string[]): BulkEditFields {
  const fields: Required<BulkEditFields> = { numbers: [], dates: [], strings: [], booleans: [] };
  for (const fieldName of fieldNames) {
    const column = metadata.findColumnWithPropertyName(fieldName);
    if (!column) throw new Error(`bulk edit field ${fieldName} is not a column of ${metadata.name}`);
    const type = column.type;
    if (type === Number || numberTypes.includes(type as string)) {
      fields.numbers.push(fieldName);
    } else if (type === Date || dateTypes.includes(type as string)) {
      fields.dates.push(fieldName);
    } else if (type === Boolean || booleanTypes.includes(type as string)) {
      fields.booleans.push(fieldName);
    } else {
      fields.strings.push(fieldName);
    }
  }
  return fields;
}
