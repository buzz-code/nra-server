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
