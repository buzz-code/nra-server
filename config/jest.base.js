const { pathsToModuleNameMapper } = require('ts-jest');

module.exports = function makeJestBase(compilerOptions) {
  return {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
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
