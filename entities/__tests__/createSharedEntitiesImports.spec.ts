import { createSharedEntitiesImports } from '../createSharedEntitiesImports';

describe('createSharedEntitiesImports', () => {
  it('returns an array of exactly 10 items', () => {
    const imports = createSharedEntitiesImports();
    expect(imports).toHaveLength(10);
  });

  it('each item is a DynamicModule (has a module property)', () => {
    const imports = createSharedEntitiesImports();
    for (const item of imports) {
      expect(item).toHaveProperty('module');
    }
  });
});
