import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { AuditLog } from '@shared/entities/AuditLog.entity';
import { McpTool, McpToolContext, McpToolError } from '../mcp.types';
import { ScopedTable, scopeSql } from './support-sql';

const MAX_ROWS = 200;
const QUERY_TIMEOUT_MS = 10_000;
const MAX_CELL_LENGTH = 2000;
/** Columns of `users` a support session may read: no password, tokens or settings blob. */
const USER_COLUMNS = ['id', 'name', 'email', 'phone_number', 'active', 'created_at', 'updated_at', 'effective_id', 'permissions', 'userInfo', 'isPaid', 'paymentMethod'];
export const AUDIT_ENTITY = 'mcp_support';

/**
 * Admin support access over MCP: read-only SQL on one user's rows, for a limited time.
 * Every grant and query is written to the audit log (entityName `mcp_support`, userId = the admin, entityId = the user).
 */
@Injectable()
export class McpSupportService {
  private readonly logger = new Logger('McpSupport');
  private scopedTables?: Record<string, ScopedTable & { allColumns: string[] }>;
  private existingTables?: Set<string>;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Tables with a user column (and `users` itself, reduced to safe columns), from the app's TypeORM entities. */
  tables() {
    if (!this.scopedTables) {
      const tables: Record<string, ScopedTable & { allColumns: string[] }> = {};
      for (const meta of this.dataSource.entityMetadatas) {
        const name = meta.tableName.toLowerCase();
        const allColumns = meta.columns.map((c) => c.databaseName);
        if (name === 'users') {
          const columns = USER_COLUMNS.filter((c) => allColumns.includes(c));
          tables[name] = { table: meta.tableName, userColumn: 'id', columns, allColumns: columns };
          continue;
        }
        const userColumn = meta.columns.find((c) => c.propertyName === 'userId')?.databaseName;
        if (userColumn) tables[name] = { table: meta.tableName, userColumn, allColumns };
      }
      this.scopedTables = tables;
    }
    return this.scopedTables;
  }

  async audit(adminId: number, userId: number, operation: string, data: object) {
    try {
      await this.dataSource.getRepository(AuditLog).insert({ userId: adminId, entityId: userId, entityName: AUDIT_ENTITY, operation, entityData: data });
    } catch (e) {
      this.logger.error(`Audit write failed (${operation}, admin ${adminId}, user ${userId})`, e?.stack);
    }
    this.logger.log(`${operation} admin=${adminId} user=${userId} ${JSON.stringify(data).slice(0, 500)}`);
  }

  /** Every table and view in the app's database, so a query's CTE can't borrow one's name. */
  private async allTableNames(): Promise<Set<string>> {
    if (!this.existingTables) {
      const rows: { name: string }[] = await this.dataSource.query(
        'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()',
      );
      this.existingTables = new Set(rows.map((r) => String(r.name).toLowerCase()));
    }
    return this.existingTables;
  }

  async query(sql: string, ctx: McpToolContext) {
    const started = Date.now();
    let scoped: string;
    try {
      scoped = scopeSql(sql, {
        tables: this.tables(),
        database: this.dataSource.driver.database,
        existingTables: await this.allTableNames(),
        userId: ctx.userId,
        maxRows: MAX_ROWS,
      });
    } catch (e) {
      await this.audit(ctx.support.adminId, ctx.userId, 'sql_refused', { sql, error: e?.message });
      throw e;
    }
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.query(`SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`);
      await runner.query('START TRANSACTION READ ONLY');
      const rows: any[] = await runner.query(scoped);
      await this.audit(ctx.support.adminId, ctx.userId, 'sql_query', { sql, rows: rows.length, ms: Date.now() - started });
      return { rows: rows.map(trimRow), rowCount: rows.length, truncated: rows.length >= MAX_ROWS };
    } catch (e) {
      if (e instanceof McpToolError) throw e;
      await this.audit(ctx.support.adminId, ctx.userId, 'sql_error', { sql, error: e?.message });
      throw new McpToolError(`SQL error: ${e?.sqlMessage ?? e?.message ?? 'failed'}`);
    } finally {
      await runner.query('ROLLBACK').catch(() => undefined);
      await runner.query('SET SESSION max_execution_time = DEFAULT').catch(() => undefined);
      await runner.release();
    }
  }

  /** The tools a support session adds to the app's own read-only tools. */
  tools(): McpTool[] {
    return [
      {
        name: 'sql_schema',
        description: 'Support session: lists the tables and columns sql_query can read. Every table holds only the selected user\'s rows.',
        inputSchema: {},
        handler: async () =>
          Object.entries(this.tables())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([table, { allColumns }]) => ({ table, columns: allColumns })),
      },
      {
        name: 'sql_query',
        description:
          `Support session: runs one read-only MySQL SELECT (JOIN, UNION, WITH allowed) on the selected user's data. ` +
          `Tables see only that user's rows; use plain table names (no database prefix). At most ${MAX_ROWS} rows, ${QUERY_TIMEOUT_MS / 1000}s. Every query is audited.`,
        inputSchema: { sql: z.string().min(1).max(10_000).describe('One SELECT statement') },
        handler: async ({ sql }, ctx) => this.query(sql, ctx),
      },
    ];
  }
}

function trimRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === 'string' && value.length > MAX_CELL_LENGTH ? `${value.slice(0, MAX_CELL_LENGTH)}…` : value;
  }
  return out;
}
