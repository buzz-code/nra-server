import { databaseConfig } from "@shared/config/database.config";
import { DataSource, DataSourceOptions, EntityTarget, FindOneOptions, ObjectLiteral } from "typeorm";

export async function getDataSource(entities: DataSourceOptions['entities']) {
    const dataSource = new DataSource(Object.assign(Object.assign({}, databaseConfig), { entities }));
    await dataSource.initialize();
    return dataSource;
}

export async function findOneAndAssignReferenceId(
    dataSource: DataSource,
    repository: EntityTarget<ObjectLiteral>,
    where: FindOneOptions['where'] = {},
    userId: number,
    referenceIdValue: any,
    keyValue: any,
) {
    if (keyValue && !referenceIdValue) {
        const item = await dataSource.getRepository(repository)
            .findOne({
                where: Object.assign(Object.assign({}, where), { userId: userId })
            });
        return item === null || item === void 0 ? void 0 : item.id;
    }
    return referenceIdValue;
}

/**
 * The inverse of findOneAndAssignReferenceId: given a referenceId (a row's
 * own id — typically just picked via a friendly reference dropdown), looks
 * up that row and returns its stable `key` field, for entities (Lesson,
 * Klass, ...) whose id is re-created every year but whose `key` isn't.
 * Falls back to the existing keyValue when referenceIdValue is absent or the
 * row no longer resolves (e.g. it belonged to a year that's since changed),
 * rather than clobbering a previously-known key with nothing.
 */
export async function findOneAndAssignKey(
    dataSource: DataSource,
    repository: EntityTarget<ObjectLiteral>,
    userId: number,
    referenceIdValue: any,
    keyValue: any,
    keyField: string = 'key',
) {
    if (referenceIdValue) {
        const item = await dataSource.getRepository(repository)
            .findOne({ where: { id: referenceIdValue, userId } as any });
        return (item as any)?.[keyField] ?? keyValue;
    }
    return keyValue;
}

export async function findManyAndAssignReferenceIds(
    dataSource: DataSource,
    repository: EntityTarget<ObjectLiteral>,
    where: FindOneOptions['where'] = {},
    userId: number,
    referenceIdValue: any,
    keyValue: any,
) {
    if (keyValue && !referenceIdValue) {
        const items = await dataSource.getRepository(repository)
            .find({
                where: Object.assign(Object.assign({}, where), { userId: userId })
            });
        return items.map(item => item.id);
    }
    return referenceIdValue;
}
