import { join } from "path";
import { DataSource } from "typeorm";
import { databaseConfig } from "./database.config";

const dataSource = new DataSource({
    ...databaseConfig,
    entities: [
        join(__dirname, '/../../src/db/**/*.ts'),
        join(__dirname, '/../../shared/entities/**/*.ts'),
],
});
export default dataSource;

// run migration like this:
// yarn typeorm:generate src/migrations/addImportFileTable -p