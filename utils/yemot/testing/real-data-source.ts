import { join } from 'path';
import { DataSource } from 'typeorm';

/**
 * Create a real in-memory SQLite DataSource using glob patterns
 * (same pattern as the real app's migration.config.ts).
 *
 * Auto-detects the project's server root from this file's location:
 *   __dirname = <project>/server/shared/utils/yemot/testing/
 *   serverRoot = __dirname/../../..  = <project>/server/
 *
 * ALL TypeORM features work: relations, order, createQueryBuilder,
 * Brackets, delete, Between, Raw, LessThan, Like, IsNull, etc.
 *
 * Usage:
 *   const ds = await createRealDataSource();
 *   // ds is a fully initialized TypeORM DataSource with sqlite3
 *   await ds.destroy();  // clean up when done
 */
export async function createRealDataSource(): Promise<DataSource> {
  // Auto-detect project server root from this file's location
  // this file: <project>/server/shared/utils/yemot/testing/real-data-source.ts
  // serverRoot: <project>/server/
  const serverRoot = join(__dirname, '..', '..', '..', '..');

  const ds = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    dropSchema: true,
    logging: false,
    entities: [
      join(serverRoot, 'src/db/**/*.{js,ts}'),
      join(serverRoot, 'shared/entities/**/*.entity.{js,ts}'),
      join(serverRoot, 'shared/view-entities/**/*.{js,ts}'),
    ],
  });

  await ds.initialize();

  // Create views manually — synchronize:true only creates tables, not views.
  // TextByUser is a ViewEntity used by getTextByUserId() in the base handler.
  await ds.query(`
    CREATE VIEW IF NOT EXISTS text_by_user AS
    SELECT users.id || '_' || t_base.id AS id,
           users.id AS userId,
           t_base.name AS name,
           t_base.description AS description,
           COALESCE(t_user.value, t_base.value) AS value,
           COALESCE(t_user.filepath, t_base.filepath) AS filepath,
           t_user.id AS overrideTextId
    FROM texts t_base
    LEFT JOIN users ON users.effective_id IS NULL
    LEFT JOIN texts t_user ON t_user.name = t_base.name AND t_user.user_id = users.id
    ORDER BY users.id, t_base.id
  `);

  return ds;
}
