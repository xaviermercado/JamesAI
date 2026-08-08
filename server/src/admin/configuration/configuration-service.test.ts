import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createBaselineConfiguration } from './configuration-baseline';
import type {
  AuditEntryInput,
  ConfigurationRepositoryLike,
  CreateDraftInput,
  MutationResult,
  SaveDraftInput,
  StoredConfiguration,
} from './configuration-repository';
import { ConfigurationOperationError, ConfigurationService } from './configuration-service';

class InMemoryConfigurationRepository implements ConfigurationRepositoryLike {
  readonly configurations = new Map<string, StoredConfiguration>();
  readonly audits: AuditEntryInput[] = [];
  activeId: string | null = null;
  private nextVersion = 1;

  async createDraft(input: CreateDraftInput): Promise<StoredConfiguration> {
    const now = new Date();
    const stored: StoredConfiguration = {
      configurationId: input.configurationId,
      versionNumber: this.nextVersion++,
      status: 'draft',
      schemaVersion: input.schemaVersion,
      configurationJson: input.configurationJson,
      configurationHash: input.configurationHash,
      changeReason: input.changeReason,
      validationStatus: 'pending',
      validationErrorsJson: null,
      validatedAt: null,
      sourceConfigurationId: input.sourceConfigurationId ?? null,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
      publishedByUserId: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      rowVersion: 1,
    };
    this.configurations.set(stored.configurationId, stored);
    return structuredClone(stored);
  }

  async saveDraft(input: SaveDraftInput): Promise<MutationResult> {
    const current = this.configurations.get(input.configurationId);
    const failure = this.writeFailure(current, input.expectedRowVersion);
    if (failure) return failure;
    const updated: StoredConfiguration = {
      ...current!, schemaVersion: input.schemaVersion, configurationJson: input.configurationJson,
      configurationHash: input.configurationHash, changeReason: input.changeReason,
      validationStatus: 'pending', validationErrorsJson: null, validatedAt: null,
      updatedByUserId: input.actorUserId, updatedAt: new Date(), rowVersion: current!.rowVersion + 1,
    };
    this.configurations.set(input.configurationId, updated);
    return { outcome: 'success', configuration: structuredClone(updated) };
  }

  async deleteDraft(configurationId: string, expectedRowVersion: number): Promise<'success' | 'not_found' | 'conflict' | 'not_draft'> {
    const current = this.configurations.get(configurationId);
    const failure = this.writeFailure(current, expectedRowVersion);
    if (failure) return failure.outcome === 'invalid' ? 'conflict' : failure.outcome;
    this.configurations.delete(configurationId);
    return 'success';
  }

  async recordValidation(configurationId: string, expectedRowVersion: number, status: 'valid' | 'invalid', errorsJson: string | null, actorUserId: string | null): Promise<MutationResult> {
    const current = this.configurations.get(configurationId);
    const failure = this.writeFailure(current, expectedRowVersion);
    if (failure) return failure;
    const updated: StoredConfiguration = {
      ...current!, validationStatus: status, validationErrorsJson: errorsJson, validatedAt: new Date(),
      updatedByUserId: actorUserId, rowVersion: current!.rowVersion + 1,
    };
    this.configurations.set(configurationId, updated);
    return { outcome: 'success', configuration: structuredClone(updated) };
  }

  async getConfiguration(configurationId: string): Promise<StoredConfiguration | null> {
    const stored = this.configurations.get(configurationId);
    return stored ? structuredClone(stored) : null;
  }

  async listConfigurations(limit = 50, offset = 0): Promise<StoredConfiguration[]> {
    return [...this.configurations.values()]
      .sort((left, right) => right.versionNumber - left.versionNumber)
      .slice(offset, offset + limit)
      .map((stored) => structuredClone(stored));
  }

  async getActiveConfiguration(): Promise<StoredConfiguration | null> {
    return this.activeId ? this.getConfiguration(this.activeId) : null;
  }

  async publish(configurationId: string, expectedRowVersion: number, actorUserId: string | null): Promise<MutationResult> {
    const target = this.configurations.get(configurationId);
    if (!target) return { outcome: 'not_found' };
    if (this.activeId === configurationId && target.status === 'published') {
      return { outcome: 'success', configuration: structuredClone(target) };
    }
    const failure = this.writeFailure(target, expectedRowVersion);
    if (failure) return failure;
    if (target.validationStatus !== 'valid') return { outcome: 'invalid' };
    if (this.activeId) {
      const previous = this.configurations.get(this.activeId);
      if (previous?.status === 'published') this.configurations.set(this.activeId, { ...previous, status: 'superseded', rowVersion: previous.rowVersion + 1 });
    }
    const published: StoredConfiguration = {
      ...target, status: 'published', publishedByUserId: actorUserId, publishedAt: new Date(),
      updatedByUserId: actorUserId, rowVersion: target.rowVersion + 1,
    };
    this.configurations.set(configurationId, published);
    this.activeId = configurationId;
    this.audits.push({ actorUserId, action: 'configuration_published', targetId: configurationId, outcome: 'succeeded', summary: {} });
    return { outcome: 'success', configuration: structuredClone(published) };
  }

  async rollback(sourceConfigurationId: string, actorUserId: string | null, changeReason: string | null): Promise<MutationResult> {
    const source = this.configurations.get(sourceConfigurationId);
    if (!source) return { outcome: 'not_found' };
    if (source.status === 'draft' || source.validationStatus !== 'valid') return { outcome: 'invalid' };
    if (this.activeId) {
      const previous = this.configurations.get(this.activeId);
      if (previous?.status === 'published') this.configurations.set(this.activeId, { ...previous, status: 'superseded', rowVersion: previous.rowVersion + 1 });
    }
    const now = new Date();
    const copy: StoredConfiguration = {
      ...source,
      configurationId: randomUUID(),
      versionNumber: this.nextVersion++,
      status: 'published',
      changeReason,
      sourceConfigurationId,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
      publishedByUserId: actorUserId,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      rowVersion: 1,
    };
    this.configurations.set(copy.configurationId, copy);
    this.activeId = copy.configurationId;
    this.audits.push({ actorUserId, action: 'configuration_rolled_back', targetId: copy.configurationId, outcome: 'succeeded', summary: { sourceConfigurationId } });
    return { outcome: 'success', configuration: structuredClone(copy) };
  }

  async appendAudit(entry: AuditEntryInput): Promise<void> {
    this.audits.push(structuredClone(entry));
  }

  corruptActiveJson(json: string): void {
    if (!this.activeId) throw new Error('No active configuration');
    const current = this.configurations.get(this.activeId)!;
    this.configurations.set(this.activeId, { ...current, configurationJson: json, rowVersion: current.rowVersion + 1 });
  }

  private writeFailure(current: StoredConfiguration | undefined, expectedRowVersion: number): Exclude<MutationResult, { outcome: 'success' }> | null {
    if (!current) return { outcome: 'not_found' };
    if (current.status !== 'draft') return { outcome: 'not_draft' };
    if (current.rowVersion !== expectedRowVersion) return { outcome: 'conflict' };
    return null;
  }
}

describe('configuration service concurrency contracts', () => {
  it('rejects a stale draft writer without overwriting the winner', async () => {
    const repository = new InMemoryConfigurationRepository();
    const service = new ConfigurationService(repository);
    const draft = await service.createDraft('editor-1');
    const winner = createBaselineConfiguration();
    winner.priorityAxes.recentVsClassic = 1;
    const loser = createBaselineConfiguration();
    loser.priorityAxes.recentVsClassic = -1;

    const saved = await service.saveDraft(draft.configurationId, draft.rowVersion, winner, 'editor-1', 'Newer titles');
    await expect(service.saveDraft(draft.configurationId, draft.rowVersion, loser, 'editor-2', 'Older titles'))
      .rejects.toMatchObject({ code: 'conflict' });
    expect(JSON.parse((await repository.getConfiguration(draft.configurationId))!.configurationJson).priorityAxes.recentVsClassic).toBe(1);
    expect(saved.rowVersion).toBe(2);
  });

  it('publishes atomically, keeps one active pointer, and makes repeat publishing idempotent', async () => {
    const repository = new InMemoryConfigurationRepository();
    const service = new ConfigurationService(repository);
    const firstDraft = await service.createDraft('owner');
    const first = await service.publish(firstDraft.configurationId, firstDraft.rowVersion, 'owner');
    const repeated = await service.publish(first.configurationId, first.rowVersion, 'owner');
    expect(repeated.configurationId).toBe(first.configurationId);
    expect(repository.audits.filter((entry) => entry.action === 'configuration_published')).toHaveLength(1);

    const secondDraft = await service.createDraft('owner');
    const second = await service.publish(secondDraft.configurationId, secondDraft.rowVersion, 'owner');
    expect(repository.activeId).toBe(second.configurationId);
    expect((await repository.getConfiguration(first.configurationId))?.status).toBe('superseded');
    expect([...repository.configurations.values()].filter((entry) => entry.status === 'published')).toHaveLength(1);
    await expect(service.saveDraft(first.configurationId, first.rowVersion, createBaselineConfiguration(), 'owner', null))
      .rejects.toMatchObject({ code: 'not_draft' });
  });

  it('rolls back as a new published version without mutating the source', async () => {
    const repository = new InMemoryConfigurationRepository();
    const service = new ConfigurationService(repository);
    const originalDraft = await service.createDraft('owner');
    const original = await service.publish(originalDraft.configurationId, originalDraft.rowVersion, 'owner');
    const nextDraft = await service.createDraft('owner');
    await service.publish(nextDraft.configurationId, nextDraft.rowVersion, 'owner');

    const rollback = await service.rollback(original.configurationId, 'owner', 'Restore baseline');
    expect(rollback.configurationId).not.toBe(original.configurationId);
    expect(rollback.sourceConfigurationId).toBe(original.configurationId);
    expect(rollback.configurationHash).toBe(original.configurationHash);
    expect(repository.activeId).toBe(rollback.configurationId);
    expect((await repository.getConfiguration(original.configurationId))?.configurationJson).toBe(original.configurationJson);
  });
});

describe('configuration service validation and cache', () => {
  it('returns field-level, non-technical errors and does not persist previews', async () => {
    const repository = new InMemoryConfigurationRepository();
    const service = new ConfigurationService(repository);
    const invalid = createBaselineConfiguration();
    invalid.titleControls.include = [{ mediaType: 'movie', tmdbId: 10 }];
    invalid.titleControls.exclude = [{ mediaType: 'movie', tmdbId: 10 }];
    await expect(service.preview(invalid)).rejects.toBeInstanceOf(ConfigurationOperationError);
    try {
      await service.preview(invalid);
    } catch (error) {
      expect(error).toMatchObject({
        message: 'Some configuration fields need attention.',
        fieldErrors: expect.arrayContaining([expect.objectContaining({ message: 'A title cannot be both included and excluded' })]),
      });
    }
    expect(repository.configurations.size).toBe(0);
    expect(repository.audits.every((entry) => entry.action === 'sandbox_executed')).toBe(true);
  });

  it('bootstraps a neutral baseline and retains the last known valid value after corruption', async () => {
    const repository = new InMemoryConfigurationRepository();
    const service = new ConfigurationService(repository);
    const first = await service.getEffectiveConfiguration();
    expect(first.configuration.priorityAxes.popularityVsDiscovery).toBe(0);
    expect(repository.activeId).toBe(first.stored.configurationId);
    expect([...repository.configurations.values()].filter((entry) => entry.status === 'published')).toHaveLength(1);

    repository.corruptActiveJson('{"schemaVersion":999}');
    const fallback = await service.getEffectiveConfiguration();
    expect(fallback.configuration).toEqual(first.configuration);
    expect(fallback.stored.configurationId).toBe(first.stored.configurationId);
  });
});