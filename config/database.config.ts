import { join } from "path";
import { DataSourceOptions } from "typeorm";
import { KeyvCacheProvider } from "typeorm-cache";

const cacheTTL = 300_000;

export const databaseConfig: DataSourceOptions = {
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
    migrationsRun: process.env.NODE_ENV == 'production' ||
        // true ||
        false,
    migrations: [join(__dirname, '/../../src/migrations/*.js')],
};
