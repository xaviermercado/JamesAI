import { randomUUID } from 'node:crypto';

import type { Pool } from 'mysql2';

export type ConfigurationStatus = 'draft' | 'published' | 'superseded';
export type ValidationStatus = 'pending' | 'valid' | 'invalid';
export type ConfigurationAuditAction =
  | 'draft_created'
  | 'draft_saved'
  | 'draft_validated'
  | 'sandbox_executed'
  | 'configuration_published'
  | 'configuration_rolled_back';

export interface StoredConfiguration {
  configurationId: string;
  versionNumber: number;
  status: ConfigurationStatus;
  schemaVersion: number;
  configurationJson: string;
  configurationHash: string;
  changeReason: string | null;
  validationStatus: ValidationStatus;
  validationErrorsJson: string | null;
  validatedAt: Date | null;
  sourceConfigurationId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  publishedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  rowVersion: number;
}

export interface CreateDraftInput {
  configurationId: string;
  schemaVersion: number;
  configurationJson: string;
  configurationHash: string;
  changeReason: string | null;
  actorUserId: string | null;
  sourceConfigurationId?: string | null;
}

export interface SaveDraftInput {
  configurationId: string;
  expectedRowVersion: number;
  schemaVersion: number;
  configurationJson: string;
  configurationHash: string;
  changeReason: string | null;
  actorUserId: string | null;
}

export interface AuditEntryInput {
  actorUserId: string | null;
  action: ConfigurationAuditAction;
  targetId: string | null;
  outcome: 'succeeded' | 'failed' | 'denied';
  summary: Record<string, unknown>;
}

export type MutationResult =
  | { outcome: 'success'; configuration: StoredConfiguration }
  | { outcome: 'not_found' | 'conflict' | 'not_draft' | 'invalid' };

export interface ConfigurationRepositoryLike {
  createDraft(input: CreateDraftInput): Promise<StoredConfiguration>;
  saveDraft(input: SaveDraftInput): Promise<MutationResult>;
  deleteDraft(configurationId: string, expectedRowVersion: number): Promise<'success' | 'not_found' | 'conflict' | 'not_draft'>;
  recordValidation(configurationId: string, expectedRowVersion: number, status: 'valid' | 'invalid', errorsJson: string | null, actorUserId: string | null): Promise<MutationResult>;
  getConfiguration(configurationId: string): Promise<StoredConfiguration | null>;
  listConfigurations(limit?: number, offset?: number): Promise<StoredConfiguration[]>;
  getActiveConfiguration(): Promise<StoredConfiguration | null>;
  publish(configurationId: string, expectedRowVersion: number, actorUserId: string | null): Promise<MutationResult>;
  rollback(sourceConfigurationId: string, actorUserId: string | null, changeReason: string | null): Promise<MutationResult>;
  appendAudit(entry: AuditEntryInput): Promise<void>;
}

interface ConfigurationRow {
  configuration_id: string;
  version_number: number | string;
  status: ConfigurationStatus;
  schema_version: number;
  configuration_json: unknown;
  configuration_hash: string;
  change_reason: string | null;
  validation_status: ValidationStatus;
  validation_errors_json: unknown | null;
  validated_at: Date | null;
  source_configuration_id: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  published_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  row_version: number | string;
}

type PromisePool = ReturnType<Pool['promise']>;
type PromisePoolConnection = Awaited<ReturnType<PromisePool['getConnection']>>;
type SqlExecutor = Pick<PromisePool, 'query'> | Pick<PromisePoolConnection, 'query'>;

const CONFIGURATION_COLUMNS = `configuration_id, version_number, status, schema_version, configuration_json,
  configuration_hash, change_reason, validation_status, validation_errors_json, validated_at,
  source_configuration_id, created_by_user_id, updated_by_user_id, published_by_user_id,
  created_at, updated_at, published_at, row_version`;

function jsonText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function mapRow(row: ConfigurationRow): StoredConfiguration {
  return {
    configurationId: row.configuration_id,
    versionNumber: Number(row.version_number),
    status: row.status,
    schemaVersion: row.schema_version,
    configurationJson: jsonText(row.configuration_json),
    configurationHash: row.configuration_hash,
    changeReason: row.change_reason,
    validationStatus: row.validation_status,
    validationErrorsJson: row.validation_errors_json === null ? null : jsonText(row.validation_errors_json),
    validatedAt: row.validated_at,
    sourceConfigurationId: row.source_configuration_id,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    publishedByUserId: row.published_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    rowVersion: Number(row.row_version),
  };
}

async function selectConfiguration(executor: SqlExecutor, configurationId: string, forUpdate = false): Promise<StoredConfiguration | null> {
  const [rows] = await executor.query(
    `SELECT ${CONFIGURATION_COLUMNS} FROM james_configurations WHERE configuration_id = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [configurationId],
  );
  const row = (rows as ConfigurationRow[])[0];
  return row ? mapRow(row) : null;
}

async function appendAuditWith(executor: SqlExecutor, entry: AuditEntryInput): Promise<void> {
  await executor.query(
    `INSERT INTO james_admin_audit_log
      (audit_id, actor_user_id, action, target_type, target_id, outcome, summary_json, occurred_at)
     VALUES (?, ?, ?, 'configuration', ?, ?, ?, NOW(3))`,
    [randomUUID(), entry.actorUserId, entry.action, entry.targetId, entry.outcome, JSON.stringify(entry.summary)],
  );
}

export class MySqlConfigurationRepository implements ConfigurationRepositoryLike {
  constructor(private readonly pool: PromisePool) {}

  async createDraft(input: CreateDraftInput): Promise<StoredConfiguration> {
    await this.pool.query(
      `INSERT INTO james_configurations
        (configuration_id, status, schema_version, configuration_json, configuration_hash, change_reason,
         validation_status, source_configuration_id, created_by_user_id, updated_by_user_id, row_version)
       VALUES (?, 'draft', ?, CAST(? AS JSON), ?, ?, 'pending', ?, ?, ?, 1)`,
      [input.configurationId, input.schemaVersion, input.configurationJson, input.configurationHash, input.changeReason,
        input.sourceConfigurationId ?? null, input.actorUserId, input.actorUserId],
    );
    const created = await this.getConfiguration(input.configurationId);
    if (!created) throw new Error('Configuration draft could not be created');
    return created;
  }

  async saveDraft(input: SaveDraftInput): Promise<MutationResult> {
    const [result] = await this.pool.query(
      `UPDATE james_configurations SET schema_version = ?, configuration_json = CAST(? AS JSON),
         configuration_hash = ?, change_reason = ?, validation_status = 'pending', validation_errors_json = NULL,
         validated_at = NULL, updated_by_user_id = ?, row_version = row_version + 1
       WHERE configuration_id = ? AND status = 'draft' AND row_version = ?`,
      [input.schemaVersion, input.configurationJson, input.configurationHash, input.changeReason, input.actorUserId,
        input.configurationId, input.expectedRowVersion],
    );
    if (((result as { affectedRows?: number }).affectedRows ?? 0) === 0) return this.classifyMiss(input.configurationId, input.expectedRowVersion);
    return { outcome: 'success', configuration: (await this.getConfiguration(input.configurationId))! };
  }

  async deleteDraft(configurationId: string, expectedRowVersion: number): Promise<'success' | 'not_found' | 'conflict' | 'not_draft'> {
    const [result] = await this.pool.query(
      `DELETE FROM james_configurations WHERE configuration_id = ? AND status = 'draft' AND row_version = ?`,
      [configurationId, expectedRowVersion],
    );
    if (((result as { affectedRows?: number }).affectedRows ?? 0) > 0) return 'success';
    const miss = await this.classifyMiss(configurationId, expectedRowVersion);
    return miss.outcome === 'invalid' ? 'conflict' : miss.outcome;
  }

  async recordValidation(configurationId: string, expectedRowVersion: number, status: 'valid' | 'invalid', errorsJson: string | null, actorUserId: string | null): Promise<MutationResult> {
    const [result] = await this.pool.query(
      `UPDATE james_configurations SET validation_status = ?, validation_errors_json = CAST(? AS JSON),
         validated_at = NOW(3), updated_by_user_id = ?, row_version = row_version + 1
       WHERE configuration_id = ? AND status = 'draft' AND row_version = ?`,
      [status, errorsJson ?? 'null', actorUserId, configurationId, expectedRowVersion],
    );
    if (((result as { affectedRows?: number }).affectedRows ?? 0) === 0) return this.classifyMiss(configurationId, expectedRowVersion);
    return { outcome: 'success', configuration: (await this.getConfiguration(configurationId))! };
  }

  async getConfiguration(configurationId: string): Promise<StoredConfiguration | null> {
    return selectConfiguration(this.pool, configurationId);
  }

  async listConfigurations(limit = 50, offset = 0): Promise<StoredConfiguration[]> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const boundedOffset = Math.max(0, Math.trunc(offset));
    const [rows] = await this.pool.query(
      `SELECT ${CONFIGURATION_COLUMNS} FROM james_configurations ORDER BY version_number DESC LIMIT ${boundedLimit} OFFSET ${boundedOffset}`,
    );
    return (rows as ConfigurationRow[]).map(mapRow);
  }

  async getActiveConfiguration(): Promise<StoredConfiguration | null> {
    const [rows] = await this.pool.query(
      `SELECT ${CONFIGURATION_COLUMNS.replaceAll(/\b(configuration_id|version_number|status|schema_version|configuration_json|configuration_hash|change_reason|validation_status|validation_errors_json|validated_at|source_configuration_id|created_by_user_id|updated_by_user_id|published_by_user_id|created_at|updated_at|published_at|row_version)\b/g, 'c.$1')}
       FROM james_configuration_active a
       INNER JOIN james_configurations c ON c.configuration_id = a.configuration_id
       WHERE a.singleton_id = 1 LIMIT 1`,
    );
    const row = (rows as ConfigurationRow[])[0];
    return row ? mapRow(row) : null;
  }

  async publish(configurationId: string, expectedRowVersion: number, actorUserId: string | null): Promise<MutationResult> {
    return this.inTransaction(async (connection) => {
      const [activeRows] = await connection.query(
        'SELECT configuration_id FROM james_configuration_active WHERE singleton_id = 1 FOR UPDATE',
      );
      const activeId = (activeRows as Array<{ configuration_id: string | null }>)[0]?.configuration_id ?? null;
      const target = await selectConfiguration(connection, configurationId, true);
      if (!target) return { outcome: 'not_found' };
      if (activeId === configurationId && target.status === 'published') return { outcome: 'success', configuration: target };
      if (target.status !== 'draft') return { outcome: 'not_draft' };
      if (target.rowVersion !== expectedRowVersion) return { outcome: 'conflict' };
      if (target.validationStatus !== 'valid') return { outcome: 'invalid' };

      if (activeId) {
        await connection.query(`UPDATE james_configurations SET status = 'superseded', row_version = row_version + 1 WHERE configuration_id = ? AND status = 'published'`, [activeId]);
      }
      await connection.query(
        `UPDATE james_configurations SET status = 'published', published_by_user_id = ?, published_at = NOW(3),
           updated_by_user_id = ?, row_version = row_version + 1 WHERE configuration_id = ? AND status = 'draft'`,
        [actorUserId, actorUserId, configurationId],
      );
      await connection.query(
        'UPDATE james_configuration_active SET configuration_id = ?, activated_at = NOW(3) WHERE singleton_id = 1',
        [configurationId],
      );
      await appendAuditWith(connection, {
        actorUserId, action: 'configuration_published', targetId: configurationId, outcome: 'succeeded',
        summary: { previousConfigurationId: activeId, configurationHash: target.configurationHash },
      });
      return { outcome: 'success', configuration: (await selectConfiguration(connection, configurationId))! };
    });
  }

  async rollback(sourceConfigurationId: string, actorUserId: string | null, changeReason: string | null): Promise<MutationResult> {
    return this.inTransaction(async (connection) => {
      const [activeRows] = await connection.query(
        'SELECT configuration_id FROM james_configuration_active WHERE singleton_id = 1 FOR UPDATE',
      );
      const activeId = (activeRows as Array<{ configuration_id: string | null }>)[0]?.configuration_id ?? null;
      const source = await selectConfiguration(connection, sourceConfigurationId, true);
      if (!source) return { outcome: 'not_found' };
      if (source.status === 'draft' || source.validationStatus !== 'valid') return { outcome: 'invalid' };

      const newId = randomUUID();
      await connection.query(
        `INSERT INTO james_configurations
          (configuration_id, status, schema_version, configuration_json, configuration_hash, change_reason,
           validation_status, validation_errors_json, validated_at, source_configuration_id, created_by_user_id,
           updated_by_user_id, published_by_user_id, published_at, row_version)
         VALUES (?, 'published', ?, CAST(? AS JSON), ?, ?, 'valid', NULL, NOW(3), ?, ?, ?, ?, NOW(3), 1)`,
        [newId, source.schemaVersion, source.configurationJson, source.configurationHash, changeReason,
          sourceConfigurationId, actorUserId, actorUserId, actorUserId],
      );
      if (activeId) {
        await connection.query(`UPDATE james_configurations SET status = 'superseded', row_version = row_version + 1 WHERE configuration_id = ? AND status = 'published'`, [activeId]);
      }
      await connection.query(
        'UPDATE james_configuration_active SET configuration_id = ?, activated_at = NOW(3) WHERE singleton_id = 1',
        [newId],
      );
      await appendAuditWith(connection, {
        actorUserId, action: 'configuration_rolled_back', targetId: newId, outcome: 'succeeded',
        summary: { sourceConfigurationId, previousConfigurationId: activeId },
      });
      return { outcome: 'success', configuration: (await selectConfiguration(connection, newId))! };
    });
  }

  async appendAudit(entry: AuditEntryInput): Promise<void> {
    await appendAuditWith(this.pool, entry);
  }

  private async classifyMiss(configurationId: string, expectedRowVersion: number): Promise<MutationResult> {
    const current = await this.getConfiguration(configurationId);
    if (!current) return { outcome: 'not_found' };
    if (current.status !== 'draft') return { outcome: 'not_draft' };
    if (current.rowVersion !== expectedRowVersion) return { outcome: 'conflict' };
    return { outcome: 'invalid' };
  }

  private async inTransaction<T>(operation: (connection: PromisePoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}