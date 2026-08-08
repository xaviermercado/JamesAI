import 'dotenv/config';

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadAppConfig } from '../config/env';
import { createDatabaseConnection } from './client';

const MIGRATIONS_TABLE = 'schema_migrations';

export interface MigrationFile {
  fileName: string;
  absolutePath: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  migration_name: string;
  checksum: string;
}

export function assertAppliedMigrationChecksums(files: MigrationFile[], applied: AppliedMigration[]): void {
  const filesByName = new Map(files.map((file) => [file.fileName, file]));
  for (const migration of applied) {
    const file = filesByName.get(migration.migration_name);
    if (file && file.checksum !== migration.checksum) {
      throw new Error(`Applied migration checksum mismatch: ${migration.migration_name}`);
    }
  }
}

export function getMigrationsDirectory(): string {
  return path.resolve(__dirname, 'migrations');
}

export async function listMigrationFiles(): Promise<MigrationFile[]> {
  const migrationsDirectory = getMigrationsDirectory();
  const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });
  const migrationFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const results: MigrationFile[] = [];

  for (const fileName of migrationFiles) {
    const absolutePath = path.join(migrationsDirectory, fileName);
    const sql = await fs.readFile(absolutePath, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    results.push({ fileName, absolutePath, sql, checksum });
  }

  return results;
}

async function ensureMigrationTable(pool: ReturnType<typeof createDatabaseConnection>['pool']): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function migrateDatabase(): Promise<void> {
  const config = loadAppConfig();
  if (!config.database) {
    throw new Error('MySQL configuration is required before running migrations');
  }

  const { pool } = createDatabaseConnection(config.database, { multipleStatements: true });

  try {
    await ensureMigrationTable(pool);

    const [rows] = await pool.query(`SELECT migration_name, checksum FROM ${MIGRATIONS_TABLE}`);
    const applied = rows as AppliedMigration[];
    const files = await listMigrationFiles();
    assertAppliedMigrationChecksums(files, applied);
    const appliedMigrations = new Set(applied.map((row) => row.migration_name));

    for (const file of files) {
      if (appliedMigrations.has(file.fileName)) {
        continue;
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(file.sql);
        await connection.query(`INSERT INTO ${MIGRATIONS_TABLE} (migration_name, checksum) VALUES (?, ?)`, [
          file.fileName,
          file.checksum,
        ]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  await migrateDatabase();
  console.log('Migrations applied successfully');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
