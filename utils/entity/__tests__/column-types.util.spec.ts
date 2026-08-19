const columnCalls: any[] = [];

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    Column: (...args: any[]) => {
      columnCalls.push(args);
      return actual.Column(...args);
    },
  };
});

import { LongJsonColumn } from '../column-types.util';

describe('LongJsonColumn', () => {
  beforeEach(() => {
    columnCalls.length = 0;
  });

  it('backs the column with a longtext-mapped type (via LongTextColumn)', () => {
    LongJsonColumn({ nullable: true });
    expect(columnCalls).toHaveLength(1);
    const [, options] = columnCalls[0];
    expect(options.nullable).toBe(true);
    expect(options.transformer).toBeDefined();
  });

  it('round-trips an object through the default transformer', () => {
    LongJsonColumn();
    const [, options] = columnCalls[0];
    const value = { a: 1, nested: { b: [1, 2, 3] } };
    const stored = options.transformer.to(value);
    expect(typeof stored).toBe('string');
    expect(options.transformer.from(stored)).toEqual(value);
  });

  it('passes null through the transformer unchanged', () => {
    LongJsonColumn();
    const [, options] = columnCalls[0];
    expect(options.transformer.to(null)).toBeNull();
    expect(options.transformer.from(null)).toBeNull();
  });

  it('respects a caller-supplied transformer instead of the default', () => {
    const customTransformer = { to: (v: any) => v, from: (v: any) => v };
    LongJsonColumn({ transformer: customTransformer });
    const [, options] = columnCalls[0];
    expect(options.transformer).toBe(customTransformer);
  });
});
