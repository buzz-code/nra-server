import { createSharedEntitiesImports } from '../createSharedEntitiesImports';
import userConfig from '../configs/user.config';

describe('createSharedEntitiesImports', () => {
  it('returns an array of exactly 12 items', () => {
    const imports = createSharedEntitiesImports(userConfig);
    expect(imports).toHaveLength(12);
  });

  it('each item is a DynamicModule (has a module property)', () => {
    const imports = createSharedEntitiesImports(userConfig);
    for (const item of imports) {
      expect(item).toHaveProperty('module');
    }
  });
});
