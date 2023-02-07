import { DataSource } from "typeorm";
import { databaseConfig } from "./database.config";

const dataSource = new DataSource({
    ...databaseConfig,
    entities: [__dirname + '/../../src/db/*/*.js'],
});
export default dataSource;
