import { join } from "path";
import { DataSource } from "typeorm";
import { databaseConfig } from "./database.config";

const dataSource = new DataSource({
    ...databaseConfig,
    entities: [
        join(__dirname, '/../../src/db/**/*.{js,ts}'),
        join(__dirname, '/../../shared/entities/**/*.entity.{js,ts}'),
        join(__dirname, '/../../shared/view-entities/**/*.{js,ts}'),
    ],
});
export default dataSource;

// run migration like this:
// yarn typeorm:generate src/migrations/addImportFileTable -p --dr