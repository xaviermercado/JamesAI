import { describe, expect, it } from 'vitest';

import { assertAppliedMigrationChecksums, type MigrationFile } from './migrate';

const migration: MigrationFile = {
  fileName: '0010_james_admin_studio.sql',
  absolutePath: 'migrations/0010_james_admin_studio.sql',
  sql: 'SELECT 1;',
  checksum: 'expected-checksum',
};

describe('migration checksum validation', () => {
  it('accepts unchanged applied migrations', () => {
    expect(() => assertAppliedMigrationChecksums([migration], [{
      migration_name: migration.fileName,
      checksum: migration.checksum,
    }])).not.toThrow();
  });

  it('refuses to continue when an applied migration was edited', () => {
    expect(() => assertAppliedMigrationChecksums([migration], [{
      migration_name: migration.fileName,
      checksum: 'different-checksum',
    }])).toThrow(`Applied migration checksum mismatch: ${migration.fileName}`);
  });
});