import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class AddMissingSharedEntityIndexes1771200000000 implements MigrationInterface {
    name = 'AddMissingSharedEntityIndexes1771200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const importFileTable = await queryRunner.getTable('import_file');
        if (importFileTable) {
            const hasIndex = importFileTable.indices.some(i => i.name === 'import_file_user_id_idx');
            if (!hasIndex) {
                await queryRunner.createIndex('import_file', new TableIndex({
                    name: 'import_file_user_id_idx',
                    columnNames: ['userId'],
                }));
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const importFileTable = await queryRunner.getTable('import_file');
        if (importFileTable) {
            const hasIndex = importFileTable.indices.some(i => i.name === 'import_file_user_id_idx');
            if (hasIndex) {
                await queryRunner.dropIndex('import_file', 'import_file_user_id_idx');
            }
        }
    }
}
