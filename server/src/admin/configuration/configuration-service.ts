import { createHash, randomUUID } from 'node:crypto';

import { adaptConfiguration, type ConfigurationAdapterOutput } from './configuration-adapter';
import { createBaselineConfiguration } from './configuration-baseline';
import {
  type ConfigurationFieldError,
  type JamesConfiguration,
  validateConfiguration,
} from './configuration-schema';
import type {
  ConfigurationRepositoryLike,
  MutationResult,
  StoredConfiguration,
} from './configuration-repository';

const MAX_CONFIGURATION_BYTES = 128 * 1024;

export class ConfigurationOperationError extends Error {
  constructor(
    public readonly code: 'not_found' | 'conflict' | 'not_draft' | 'invalid_configuration' | 'invalid_operation',
    message: string,
    public readonly fieldErrors: ConfigurationFieldError[] = [],
  ) {
    super(message);
    this.name = 'ConfigurationOperationError';
  }
}

export interface ConfigurationPreview {
  configuration: JamesConfiguration;
  adapterOutput: ConfigurationAdapterOutput;
  fieldErrors: ConfigurationFieldError[];
}

interface CachedConfiguration {
  stored: StoredConfiguration;
  configuration: JamesConfiguration;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function serializeConfiguration(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(canonicalize(value));
  } catch {
    throw new ConfigurationOperationError('invalid_configuration', 'The configuration could not be read.');
  }
  if (!json || Buffer.byteLength(json, 'utf8') > MAX_CONFIGURATION_BYTES) {
    throw new ConfigurationOperationError('invalid_configuration', 'The configuration is too large.');
  }
  return json;
}

function configurationHash(json: string): string {
  return createHash('sha256').update(json).digest('hex');
}

function parseStored(stored: StoredConfiguration): unknown {
  try {
    return JSON.parse(stored.configurationJson) as unknown;
  } catch {
    throw new ConfigurationOperationError('invalid_configuration', 'The saved configuration could not be read.');
  }
}

function throwMutationFailure(result: Exclude<MutationResult, { outcome: 'success' }>): never {
  switch (result.outcome) {
    case 'not_found': throw new ConfigurationOperationError('not_found', 'The configuration was not found.');
    case 'conflict': throw new ConfigurationOperationError('conflict', 'This configuration changed while you were editing it. Refresh and try again.');
    case 'not_draft': throw new ConfigurationOperationError('not_draft', 'Published configurations cannot be changed.');
    case 'invalid': throw new ConfigurationOperationError('invalid_operation', 'Validate the configuration before publishing it.');
  }
}

export class ConfigurationService {
  private lastKnownValid: CachedConfiguration | null = null;

  constructor(private readonly repository: ConfigurationRepositoryLike) {}

  async createDraft(actorUserId: string | null, input: unknown = createBaselineConfiguration(), changeReason: string | null = null): Promise<StoredConfiguration> {
    const json = serializeConfiguration(input);
    const schemaVersion = typeof input === 'object' && input !== null && (input as { schemaVersion?: unknown }).schemaVersion === 1 ? 1 : 0;
    const created = await this.repository.createDraft({
      configurationId: randomUUID(), schemaVersion, configurationJson: json, configurationHash: configurationHash(json),
      changeReason, actorUserId,
    });
    await this.repository.appendAudit({
      actorUserId, action: 'draft_created', targetId: created.configurationId, outcome: 'succeeded',
      summary: { versionNumber: created.versionNumber },
    });
    return created;
  }

  async saveDraft(configurationId: string, expectedRowVersion: number, input: unknown, actorUserId: string | null, changeReason: string | null): Promise<StoredConfiguration> {
    const json = serializeConfiguration(input);
    const schemaVersion = typeof input === 'object' && input !== null && (input as { schemaVersion?: unknown }).schemaVersion === 1 ? 1 : 0;
    const result = await this.repository.saveDraft({
      configurationId, expectedRowVersion, schemaVersion, configurationJson: json,
      configurationHash: configurationHash(json), changeReason, actorUserId,
    });
    if (result.outcome !== 'success') throwMutationFailure(result);
    await this.repository.appendAudit({
      actorUserId, action: 'draft_saved', targetId: configurationId, outcome: 'succeeded',
      summary: { rowVersion: result.configuration.rowVersion },
    });
    return result.configuration;
  }

  async deleteDraft(configurationId: string, expectedRowVersion: number): Promise<void> {
    const result = await this.repository.deleteDraft(configurationId, expectedRowVersion);
    if (result === 'success') return;
    throwMutationFailure({ outcome: result });
  }

  getConfiguration(configurationId: string): Promise<StoredConfiguration | null> {
    return this.repository.getConfiguration(configurationId);
  }

  listConfigurations(limit?: number, offset?: number): Promise<StoredConfiguration[]> {
    return this.repository.listConfigurations(limit, offset);
  }

  async validateDraft(configurationId: string, expectedRowVersion: number, actorUserId: string | null): Promise<{ configuration: StoredConfiguration; fieldErrors: ConfigurationFieldError[] }> {
    const stored = await this.requireConfiguration(configurationId);
    if (stored.status !== 'draft') throw new ConfigurationOperationError('not_draft', 'Published configurations cannot be changed.');
    if (stored.rowVersion !== expectedRowVersion) throw new ConfigurationOperationError('conflict', 'This configuration changed while you were editing it. Refresh and try again.');
    const validation = validateConfiguration(parseStored(stored));
    const fieldErrors = validation.success ? [] : validation.errors;
    const result = await this.repository.recordValidation(
      configurationId, expectedRowVersion, validation.success ? 'valid' : 'invalid',
      fieldErrors.length ? JSON.stringify(fieldErrors) : null, actorUserId,
    );
    if (result.outcome !== 'success') throwMutationFailure(result);
    await this.repository.appendAudit({
      actorUserId, action: 'draft_validated', targetId: configurationId,
      outcome: validation.success ? 'succeeded' : 'failed', summary: { errorCount: fieldErrors.length },
    });
    return { configuration: result.configuration, fieldErrors };
  }

  async preview(input: unknown, now = new Date(), actorUserId: string | null = null): Promise<ConfigurationPreview> {
    const validation = validateConfiguration(input);
    if (!validation.success) {
      await this.repository.appendAudit({
        actorUserId, action: 'sandbox_executed', targetId: null, outcome: 'failed',
        summary: { errorCount: validation.errors.length },
      });
      throw new ConfigurationOperationError('invalid_configuration', 'Some configuration fields need attention.', validation.errors);
    }
    await this.repository.appendAudit({
      actorUserId, action: 'sandbox_executed', targetId: null, outcome: 'succeeded', summary: { schemaVersion: 1 },
    });
    return { configuration: validation.configuration, adapterOutput: adaptConfiguration(validation.configuration, now), fieldErrors: [] };
  }

  async publish(configurationId: string, expectedRowVersion: number, actorUserId: string | null): Promise<StoredConfiguration> {
    let stored = await this.requireConfiguration(configurationId);
    const active = await this.repository.getActiveConfiguration();
    if (active?.configurationId === configurationId && stored.status === 'published') return stored;
    if (stored.status !== 'draft') throw new ConfigurationOperationError('not_draft', 'Only a draft can be published.');
    if (stored.rowVersion !== expectedRowVersion) throw new ConfigurationOperationError('conflict', 'This configuration changed while you were editing it. Refresh and try again.');

    const validation = validateConfiguration(parseStored(stored));
    const errors = validation.success ? [] : validation.errors;
    const validationResult = await this.repository.recordValidation(
      configurationId, stored.rowVersion, validation.success ? 'valid' : 'invalid',
      errors.length ? JSON.stringify(errors) : null, actorUserId,
    );
    if (validationResult.outcome !== 'success') throwMutationFailure(validationResult);
    if (!validation.success) {
      throw new ConfigurationOperationError('invalid_configuration', 'Some configuration fields need attention.', errors);
    }
    stored = validationResult.configuration;
    const result = await this.repository.publish(configurationId, stored.rowVersion, actorUserId);
    if (result.outcome !== 'success') throwMutationFailure(result);
    this.invalidateCache();
    this.lastKnownValid = { stored: result.configuration, configuration: validation.configuration };
    return result.configuration;
  }

  async rollback(sourceConfigurationId: string, actorUserId: string | null, changeReason: string | null): Promise<StoredConfiguration> {
    const source = await this.requireConfiguration(sourceConfigurationId);
    const validation = validateConfiguration(parseStored(source));
    if (!validation.success || source.status === 'draft') {
      throw new ConfigurationOperationError('invalid_operation', 'Choose a previously published valid configuration.');
    }
    const result = await this.repository.rollback(sourceConfigurationId, actorUserId, changeReason);
    if (result.outcome !== 'success') throwMutationFailure(result);
    this.invalidateCache();
    this.lastKnownValid = { stored: result.configuration, configuration: validation.configuration };
    return result.configuration;
  }

  async getEffectiveConfiguration(): Promise<CachedConfiguration> {
    const active = await this.repository.getActiveConfiguration();
    if (!active) return this.bootstrapBaseline();
    if (this.lastKnownValid?.stored.configurationId === active.configurationId &&
        this.lastKnownValid.stored.rowVersion === active.rowVersion) return this.lastKnownValid;

    const validation = validateConfiguration(parseStored(active));
    if (!validation.success) {
      if (this.lastKnownValid) return this.lastKnownValid;
      return { stored: active, configuration: createBaselineConfiguration() };
    }
    this.lastKnownValid = { stored: active, configuration: validation.configuration };
    return this.lastKnownValid;
  }

  async getEffectiveAdapterOutput(now = new Date()): Promise<ConfigurationAdapterOutput> {
    return adaptConfiguration((await this.getEffectiveConfiguration()).configuration, now);
  }

  invalidateCache(): void {
    this.lastKnownValid = null;
  }

  private async bootstrapBaseline(): Promise<CachedConfiguration> {
    const draft = await this.createDraft(null, createBaselineConfiguration(), 'Automatic baseline bootstrap');
    const validated = await this.validateDraft(draft.configurationId, draft.rowVersion, null);
    const published = await this.publish(validated.configuration.configurationId, validated.configuration.rowVersion, null);
    return { stored: published, configuration: createBaselineConfiguration() };
  }

  private async requireConfiguration(configurationId: string): Promise<StoredConfiguration> {
    const stored = await this.repository.getConfiguration(configurationId);
    if (!stored) throw new ConfigurationOperationError('not_found', 'The configuration was not found.');
    return stored;
  }
}