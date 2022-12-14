import { DataSourceOptions } from "typeorm";

export const databaseConfig: DataSourceOptions = {
    type: 'mysql',
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    // entityPrefix: 'miryam_peperman',
    // entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    // synchronize: true,
    logging: "all",
    // migrationsRun: true,
    // migrationsTableName: 'migration',
    // migrations: [__dirname + '/../migrations/*{.ts,.js}'],
};
