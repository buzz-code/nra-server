import { DataSource, DataSourceOptions } from "typeorm";
import { getDataSource } from "./foreignKey.util";

/**
 * Opens a throwaway DataSource scoped to `entities`, runs `fn` against it, and
 * always closes it afterwards - the get/try/finally-destroy pattern shared by
 * the class-validator decorators that need to run a one-off query outside of
 * NestJS's request-scoped connection (e.g. inside a validate() callback).
 */
export async function withTemporaryDataSource<T>(
    entities: DataSourceOptions['entities'],
    fn: (dataSource: DataSource) => Promise<T>,
): Promise<T> {
    const dataSource = await getDataSource(entities);
    try {
        return await fn(dataSource);
    } finally {
        await dataSource.destroy();
    }
}
