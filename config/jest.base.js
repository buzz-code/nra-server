const { pathsToModuleNameMapper } = require('ts-jest');

// Ensure tests run with the test database configuration (SQLite in-memory).
// This also drives the database-agnostic column-type helpers in shared/utils/entity/column-types.util.ts.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

module.exports = function makeJestBase(compilerOptions) {
  return {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: pathsToModuleNameMapper((compilerOptions && compilerOptions.paths) || {}),
    modulePaths: ['<rootDir>'],
    maxWorkers: 1,
    testRegex: '.*\\.(spec|test)\\.(ts|tsx)$',
    transform: { '^.+\\.(t|j)sx?$': 'ts-jest' },
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      'shared/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!shared/**/*.d.ts',
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/coverage/**',
      '!**/migrations/**',
      '!**/__tests__/**',
      '!**/main.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['json', 'lcov', 'text', 'clover'],
  };
};
