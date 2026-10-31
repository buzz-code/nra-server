const { compilerOptions } = require('./tsconfig');
const makeJestBase = require('./config/jest.base');
module.exports = {
    ...makeJestBase(compilerOptions),
    // consumers resolve `src/db/entities/User.entity` to their own User subclass; standalone uses the base entity
    moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/$1',
        '^src/db/entities/User\\.entity$': '<rootDir>/entities/User.entity',
    },
    modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
};
