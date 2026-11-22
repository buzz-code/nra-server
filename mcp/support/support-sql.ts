import { Parser } from 'node-sql-parser';
import { McpToolError } from '../mcp.types';

const parser = new Parser();
const DIALECT = { database: 'MySQL' };

/** Functions that read files, sleep, take locks or reach outside the query. Matched on the parsed SQL. */
const BLOCKED_FUNCTIONS = [
  'load_file', 'sleep', 'benchmark', 'get_lock', 'release_lock', 'release_all_locks', 'is_free_lock', 'is_used_lock',
  'master_pos_wait', 'source_pos_wait', 'wait_for_executed_gtid_set', 'sys_eval', 'sys_exec',
];
const BLOCKED_FUNCTION_RE = new RegExp(`(^|[^\\w$])\`?(${BLOCKED_FUNCTIONS.join('|')})\`?\\s*\\(`, 'i');

/** How a table is narrowed to one user: `column = userId`, and optionally only some columns. */
export interface ScopedTable {
  /** The real table name, when it differs in case from the key. */
  table?: string;
  userColumn: string;
  columns?: string[];
}

export interface ScopeOptions {
  /** Tables the query may read, by name. Any other table is refused. */
  tables: Record<string, ScopedTable>;
  /** The app's own database; each scoped table is read from it by qualified name. */
  database: string;
  /**
   * Every table and view in the database (lower case). A CTE of the query may not take one of these names:
   * inside its own definition the name would read the whole base table.
   */
  existingTables: Set<string>;
  userId: number;
  maxRows: number;
}

const quote = (name: string) => '`' + name.replace(/`/g, '``') + '`';

/**
 * Turns one SELECT into a query that sees only one user's rows. The query is parsed and only a single SELECT
 * (UNION and CTEs allowed) naming known, unqualified tables passes. It is then written back from the parse tree
 * (so comments and anything the parser didn't understand are gone), its row count capped, and each table it names
 * shadowed by a CTE of the same name that reads only that user's rows from the qualified base table.
 */
export function scopeSql(sql: string, options: ScopeOptions): string {
  let parsed: ReturnType<Parser['parse']>;
  try {
    parsed = parser.parse(sql, DIALECT);
  } catch (e) {
    throw new McpToolError(`SQL parse error: ${e?.message ?? e}`);
  }
  const ast: any = parsed.ast;
  if (Array.isArray(ast) || ast?.type !== 'select') throw new McpToolError('Only a single SELECT statement is allowed.');

  for (let node = ast; node; node = node._next) {
    if (node.into?.position) throw new McpToolError('SELECT ... INTO is not allowed.');
    if (node.locking_read) throw new McpToolError('Locking reads are not allowed.');
  }

  const ownCtes = new Set<string>((ast.with ?? []).map((cte: any) => String(cte.name?.value ?? cte.name).toLowerCase()));
  for (const name of ownCtes) {
    if (options.tables[name] || options.existingTables.has(name)) {
      throw new McpToolError(`A CTE may not be named like a table (${name}).`);
    }
  }
  const used = new Set<string>();
  for (const entry of parsed.tableList) {
    const [, db, table] = entry.split('::');
    if (db !== 'null') throw new McpToolError(`Use table names without a database (${db}.${table}).`);
    const name = table.toLowerCase();
    if (ownCtes.has(name)) continue;
    if (!options.tables[name]) throw new McpToolError(`Table "${table}" is not available. Call sql_schema for the list.`);
    used.add(name);
  }

  capLimit(ast, options.maxRows);
  const body = parser.sqlify(ast, DIALECT);
  if (BLOCKED_FUNCTION_RE.test(body)) throw new McpToolError('This function is not allowed.');

  const userId = Math.trunc(Number(options.userId));
  if (!Number.isFinite(userId) || userId <= 0) throw new McpToolError('No user selected.');
  const scopes = [...used].sort().map((name) => {
    const { table, userColumn, columns } = options.tables[name];
    const select = columns?.length ? columns.map(quote).join(', ') : '*';
    return `${quote(name)} AS (SELECT ${select} FROM ${quote(options.database)}.${quote(table ?? name)} WHERE ${quote(userColumn)} = ${userId})`;
  });
  if (!scopes.length) return body;

  // Join our CTEs to the query's own WITH list (ours first, so its CTEs can read them).
  const withMatch = /^WITH(\s+RECURSIVE)?\s+/i.exec(body);
  if (withMatch) return `WITH${withMatch[1] ?? ''} ${scopes.join(', ')}, ${body.slice(withMatch[0].length)}`;
  return `WITH ${scopes.join(', ')} ${body}`;
}

/** Caps the row count of the outermost query (the last part of a UNION carries its LIMIT). */
function capLimit(ast: any, maxRows: number) {
  let last = ast;
  while (last._next) last = last._next;
  const values = last.limit?.value ?? [];
  const countNode = values[values.length - 1];
  if (countNode?.type === 'number' && countNode.value <= maxRows) return;
  if (countNode?.type === 'number') {
    countNode.value = maxRows;
  } else {
    last.limit = { seperator: '', value: [{ type: 'number', value: maxRows }] };
  }
}
