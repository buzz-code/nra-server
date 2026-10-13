import { BadRequestException } from '@nestjs/common';
import { getAsDate, getAsNumber, getAsString } from '@shared/utils/queryParam.util';

interface BulkEditFields {
  numbers?: string[];
  dates?: string[];
  strings?: string[];
}

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
  return update;
}
