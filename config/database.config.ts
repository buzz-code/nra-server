import { join } from "path";
import { DataSourceOptions } from "typeorm";
import { KeyvCacheProvider } from "typeorm-cache";
import { UtcTimestampSubscriber } from "../utils/entity/utc-timestamp.subscriber";

export const cacheTTL = 300_000;

// Test configuration for sqlite in-memory
const testDatabaseConfig: DataSourceOptions = {
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    logging: false,
    dropSchema: true,
    migrationsRun: false,
    entities: [
        join(__dirname, '/../../src/db/**/*.{js,ts}'),
        join(__dirname, '/../../shared/entities/**/*.entity.{js,ts}'),
        join(__dirname, '/../../shared/view-entities/**/*.{js,ts}'),
    ],
    subscribers: [UtcTimestampSubscriber],
};

// Production configuration for MySQL
const productionDatabaseConfig: DataSourceOptions = {
    type: 'mysql',
    // Pin the connection to UTC so Date columns (timestamp/datetime) round-trip
    // correctly regardless of the server process's local timezone. Without this,
    // mysql2 defaults to 'local' and serializes/parses Date values using the
    // Node process's local getters (e.g. getHours() instead of getUTCHours()),
    // which silently shifts stored timestamps whenever that local timezone
    // isn't UTC.
    timezone: 'Z',
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
    subscribers: [UtcTimestampSubscriber],
};

export const databaseConfig: DataSourceOptions =
    process.env.NODE_ENV === 'test' ? testDatabaseConfig : productionDatabaseConfig;
