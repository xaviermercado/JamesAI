import { drizzle } from 'drizzle-orm/mysql2';
import { createPool, type Pool, type PoolOptions } from 'mysql2';

import type { DatabaseConfig } from '../config/env';
import * as schema from './schema';

export interface DatabaseConnection {
  pool: ReturnType<Pool['promise']>;
  db: unknown;
}

function buildSslConfig(config: DatabaseConfig): PoolOptions['ssl'] {
  if (config.sslMode === 'disabled' || config.sslMode === 'preferred') {
    return undefined;
  }

  return {
    ca: config.sslCa,
    rejectUnauthorized: true,
  };
}

export function createDatabaseConnection(
  config: DatabaseConfig,
  options?: { multipleStatements?: boolean },
): DatabaseConnection {
  const pool = createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionLimit: config.connectionLimit,
    ssl: buildSslConfig(config),
    multipleStatements: options?.multipleStatements ?? false,
  }).promise();

  const db = drizzle(pool, { schema, mode: 'default' });

  return { pool, db };
}
