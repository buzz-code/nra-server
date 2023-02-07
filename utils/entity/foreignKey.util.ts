import { databaseConfig } from "@shared/config/database.config";
import { DataSource } from "typeorm";

export async function getDataSource(entities) {
    const dataSource = new DataSource(Object.assign(Object.assign({}, databaseConfig), { entities }));
    await dataSource.initialize();
    return dataSource;
}

export async function findOneAndAssignReferenceId(dataSource, repository, where, userId, referenceIdValue, keyValue) {
    if (keyValue && !referenceIdValue) {
        const item = await dataSource.getRepository(repository)
            .findOne({
                where: Object.assign(Object.assign({}, where), { userId: userId })
            });
        return item === null || item === void 0 ? void 0 : item.id;
    }
    return referenceIdValue;
}
