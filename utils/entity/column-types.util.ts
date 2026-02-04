import { databaseConfig } from '@shared/config/database.config';
import { Column, CreateDateColumn, UpdateDateColumn, ColumnOptions } from 'typeorm';

enum DatabaseType {
  SQLITE = 'sqlite',
  MYSQL = 'mysql'
}

/**
 * Detects the current database type from environment
 * Returns 'sqlite' for test environment, 'mysql' for production
 */
function getDatabaseType(): DatabaseType {
  return databaseConfig.type === 'sqlite' ? DatabaseType.SQLITE : DatabaseType.MYSQL;
}

/**
 * Maps database-specific column types to compatible alternatives
 */
const TYPE_MAPPINGS: Record<string, Record<DatabaseType, string>> = {
  longtext: {
    sqlite: 'text',
    mysql: 'longtext'
  },
  mediumtext: {
    sqlite: 'text',
    mysql: 'mediumtext'
  },
  timestamp: {
    sqlite: 'datetime',
    mysql: 'timestamp'
  },
  tinyint: {
    sqlite: 'integer',
    mysql: 'tinyint'
  }
};

/**
 * Gets the appropriate column type for the current database
 */
function getColumnType(baseType: keyof typeof TYPE_MAPPINGS): string {
  const dbType = getDatabaseType();
  return TYPE_MAPPINGS[baseType][dbType];
}

/**
 * Custom decorators for database-agnostic column types
 */

/**
 * Long text column - maps to 'longtext' in MySQL, 'text' in SQLite
 */
export function LongTextColumn(options?: ColumnOptions) {
  const type = getColumnType('longtext') as any;
  return Column(type, options);
}

/**
 * Medium text column - maps to 'mediumtext' in MySQL, 'text' in SQLite  
 */
export function MediumTextColumn(options?: ColumnOptions) {
  const type = getColumnType('mediumtext') as any;
  return Column(type, options);
}

/**
 * Tiny integer column - maps to 'tinyint' in MySQL, 'integer' in SQLite
 * Commonly used for boolean-like values (0/1)
 */
export function TinyIntColumn(options?: ColumnOptions) {
  const type = getColumnType('tinyint') as any;
  return Column(type, options);
}

/**
 * Database-agnostic CreateDateColumn with proper timestamp handling
 */
export function CreatedAtColumn(options?: { name?: string }) {
  const dbType = getDatabaseType();
  if (dbType === DatabaseType.MYSQL) {
    return CreateDateColumn({
      name: options?.name || 'created_at',
      type: 'timestamp'
    });
  } else {
    return CreateDateColumn({
      name: options?.name || 'created_at'
    });
  }
}

/**
 * Database-agnostic UpdateDateColumn with proper timestamp handling  
 */
export function UpdatedAtColumn(options?: { name?: string }) {
  const dbType = getDatabaseType();
  if (dbType === DatabaseType.MYSQL) {
    return UpdateDateColumn({
      name: options?.name || 'updated_at',
      type: 'timestamp'
    });
  } else {
    return UpdateDateColumn({
      name: options?.name || 'updated_at'
    });
  }
}

/**
 * Boolean-like column using tinyint(1) in MySQL, integer in SQLite
 * For storing boolean values as 0/1
 */
export function BooleanIntColumn(options?: ColumnOptions) {
  const dbType = getDatabaseType();
  const defaultOptions: ColumnOptions = {
    default: false,
    ...options
  };

  if (dbType === DatabaseType.MYSQL) {
    return Column('tinyint', { width: 1, ...defaultOptions });
  } else {
    return Column('integer', defaultOptions);
  }
}

/**
 * JSON column with proper transformer for different databases
 */
export function JsonColumn(options?: ColumnOptions) {
  if (options?.type === 'json') {
    if (getDatabaseType() === DatabaseType.SQLITE) {
      delete options.type;
    }
  }
  return Column('simple-json', options);
}

/**
 * Varchar column with explicit length - works consistently across databases
 */
export function VarcharColumn(length: number, options?: ColumnOptions) {
  return Column('varchar', { length, ...options });
}

/**
 * Text column - safe for both databases
 */
export function TextColumn(options?: ColumnOptions) {
  return Column('text', options);
}

/**
 * Database-agnostic GROUP_CONCAT function
 * MySQL: GROUP_CONCAT(DISTINCT column SEPARATOR ', ')
 * SQLite: group_concat(DISTINCT column, ', ')
 */
export function getGroupConcatExpression(column: string, separator: string = ', ', distinct: boolean = true, orderBy?: string): string {
  const dbType = getDatabaseType();
  const distinctKeyword = distinct ? 'DISTINCT ' : '';
  const orderClause = orderBy ? ` ORDER BY ${orderBy}` : '';

  if (dbType === DatabaseType.MYSQL) {
    return `GROUP_CONCAT(${distinctKeyword}${column}${orderClause} SEPARATOR '${separator}')`;
  } else {
    // SQLite
    return `group_concat(${distinctKeyword}${column}, '${separator}')`;
  }
}

/**
 * Database-agnostic CONCAT function  
 * MySQL: CONCAT(col1, '_', col2)
 * SQLite: col1 || '_' || col2
 */
export function getConcatExpression(...parts: string[]): string {
  const dbType = getDatabaseType();

  if (dbType === DatabaseType.MYSQL) {
    return `CONCAT(${parts.join(', ')})`;
  } else {
    // SQLite
    return parts.join(' || ');
  }
}
