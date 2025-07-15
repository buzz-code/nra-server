import { join } from "path";
import { DataSourceOptions } from "typeorm";
import { KeyvCacheProvider } from "typeorm-cache";

const cacheTTL = 300_000;

// Test configuration for sqlite in-memory
const testDatabaseConfig: DataSourceOptions = {
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    logging: false,
    dropSchema: true,
    migrationsRun: false,
};

// Production configuration for MySQL
const productionDatabaseConfig: DataSourceOptions = {
    type: 'mysql',
    extra: {
        decimalNumbers: true
    },
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    // entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    // synchronize: true,
    charset: "utf8mb4_0900_ai_ci",
    logging: "all",
    maxQueryExecutionTime: 200,
    cache: {
        duration: cacheTTL,
        provider() {
            return new KeyvCacheProvider({
                ttl: cacheTTL,
            });
        }
    },
    migrationsRun: false,
    migrations: [join(__dirname, '/../../src/migrations/*.{js,ts}')],
    migrationsTransactionMode: "all",
};

export const databaseConfig: DataSourceOptions = 
    process.env.NODE_ENV === 'test' ? testDatabaseConfig : productionDatabaseConfig;
