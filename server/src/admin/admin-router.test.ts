import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCsrfToken } from '../auth/auth-crypto';
import type { AdminRole, AuthSessionResponse } from '../auth/auth-types';
import { adaptConfiguration, createBaselineConfiguration } from './configuration';
import type { StoredConfiguration } from './configuration/configuration-repository';
import { createAdminAuthorization, type AdminAuthSessionService } from './admin-authorization';
import { createAdminRouter } from './admin-router';

const NOW = new Date('2026-08-07T12:00:00.000Z');
const PEPPER = 'test-session-pepper';
const HASH = 'a'.repeat(64);
const CONFIGURATION_ID = '11111111-1111-4111-8111-111111111111';
const SELECTED_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function session(role: AdminRole, authenticatedAt = NOW.toISOString()): AuthSessionResponse & { identity: NonNullable<Awaited<ReturnType<AdminAuthSessionService['restoreSession']>>['identity']> } {
  return {
    authenticated: true,
    user: {
      userId: USER_ID,
      email: `${role}@example.com`,
      emailVerifiedAt: NOW.toISOString(),
      accountStatus: 'active',
      adminRole: role,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    csrfToken: createCsrfToken(HASH, PEPPER),
    authenticatedAt,
    identity: {
      userId: USER_ID,
      sessionId: 'session-id',
      sessionTokenHash: HASH,
      csrfToken: createCsrfToken(HASH, PEPPER),
      expiresAt: '2026-08-08T12:00:00.000Z',
      authenticatedAt,
    },
  };
}

function stored(configurationId = CONFIGURATION_ID): StoredConfiguration {
  return {
    configurationId,
    versionNumber: configurationId === CONFIGURATION_ID ? 1 : 2,
    status: configurationId === CONFIGURATION_ID ? 'published' : 'draft',
    schemaVersion: 1,
    configurationJson: JSON.stringify(createBaselineConfiguration()),
    configurationHash: 'b'.repeat(64),
    changeReason: null,
    validationStatus: 'valid',
    validationErrorsJson: null,
    validatedAt: NOW,
    sourceConfigurationId: null,
    createdByUserId: USER_ID,
    updatedByUserId: USER_ID,
    publishedByUserId: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    publishedAt: NOW,
    rowVersion: 1,
  };
}

function createFixture(options: { rateLimitMax?: number; nodeEnv?: string } = {}) {
  const authService: AdminAuthSessionService = {
    restoreSession: vi.fn(async (token: string) => {
      if (token === 'editor') return session('editor');
      if (token === 'owner') return session('owner');
      if (token === 'stale-owner') return session('owner', '2026-08-07T11:00:00.000Z');
      if (token === 'user') return session('user');
      return { authenticated: false, user: null, csrfToken: null, authenticatedAt: null };
    }),
  };
  const authorization = createAdminAuthorization(authService, { sessionTokenPepper: PEPPER }, { now: () => NOW });
  const active = stored();
  const selected = stored(SELECTED_ID);
  const configurationService = {
    listConfigurations: vi.fn(async () => [active, selected]),
    getEffectiveConfiguration: vi.fn(async () => ({ stored: active, configuration: createBaselineConfiguration() })),
    getConfiguration: vi.fn(async (id: string) => id === SELECTED_ID ? selected : id === CONFIGURATION_ID ? active : null),
    createDraft: vi.fn(async () => selected),
    saveDraft: vi.fn(async () => selected),
    deleteDraft: vi.fn(async () => undefined),
    validateDraft: vi.fn(async () => ({ configuration: selected, fieldErrors: [] })),
    preview: vi.fn(async () => ({
      configuration: createBaselineConfiguration(),
      adapterOutput: adaptConfiguration(createBaselineConfiguration()),
      fieldErrors: [],
    })),
    publish: vi.fn(async () => ({ ...selected, status: 'published' as const })),
    rollback: vi.fn(async () => ({ ...selected, status: 'published' as const })),
  };
  const insightsService = {
    getOverview: vi.fn(async () => ({ ok: true })),
    getSegments: vi.fn(async () => []),
    compareVersions: vi.fn(async () => ({ ok: true })),
    listFeedbackInbox: vi.fn(async () => ({ items: [], page: 1, pageSize: 25, total: 0 })),
    categorizeFeedback: vi.fn(async () => ({ status: 'conflict' as const })),
    listAuditLog: vi.fn(async () => ({ items: [], page: 1, pageSize: 25, total: 0 })),
  };
  const tmdbService = {
    searchTitles: vi.fn(async () => []),
    getRecommendations: vi.fn(async () => ({
      recommendations: [{
        tmdbMovieId: 42,
        title: 'Safe title',
        posterUrl: '',
        releaseYear: 2025,
        runtimeMinutes: 100,
        tmdbRating: 7,
        genres: ['Drama'],
        providers: ['Provider payload must not escape'],
        country: 'US',
        mediaType: 'movie' as const,
        explanation: 'A concise reason this title suits the example.',
      }],
      source: 'live' as const,
      preferencesApplied: false,
    })),
  };
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/admin', createAdminRouter({
    config: { frontendOrigin: 'https://app.example.com', nodeEnv: options.nodeEnv ?? 'development' },
    authorization,
    configurationService: configurationService as never,
    insightsService: insightsService as never,
    adminAccessRepository: {
      listAccessCandidates: vi.fn(async () => []),
      updateAdminRole: vi.fn(async () => ({ status: 'not_found' as const })),
      provisionOwnerByEmail: vi.fn(async () => ({ status: 'not_found' as const })),
    },
    tmdbService: tmdbService as never,
  }, { rateLimitMax: options.rateLimitMax, sandboxTimeoutMs: 1_000 }));
  return { app, configurationService, insightsService, tmdbService };
}

const csrf = createCsrfToken(HASH, PEPPER);
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('admin router integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enforces the direct API authorization matrix', async () => {
    const { app } = createFixture();
    const path = '/api/admin/insights/overview?startDate=2026-08-01&endDate=2026-08-07';
    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).get(path).set(bearer('user'))).status).toBe(403);
    expect((await request(app).get(path).set(bearer('editor'))).status).toBe(200);
    expect((await request(app).get(path).set(bearer('owner'))).status).toBe(200);
  });

  it('requires CSRF and rejects unknown mutation fields', async () => {
    const { app } = createFixture();
    const path = `/api/admin/configurations/${SELECTED_ID}/validate`;
    expect((await request(app).post(path).set(bearer('editor')).send({ expectedRowVersion: 1 })).status).toBe(403);
    expect((await request(app).post(path).set(bearer('editor')).set('X-CSRF-Token', csrf).send({ expectedRowVersion: 1, unexpected: true })).status).toBe(400);
    expect((await request(app).post(path).set(bearer('editor')).set('X-CSRF-Token', csrf).send({ expectedRowVersion: 1 })).status).toBe(200);
  });

  it('rejects admin bodies above the local cap', async () => {
    const { app } = createFixture();
    const response = await request(app)
      .post('/api/admin/configurations')
      .set(bearer('editor'))
      .set('X-CSRF-Token', csrf)
      .send({ configuration: { padding: 'x'.repeat(129 * 1024) } });
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Request body is too large' });
  });

  it('rate limits preview operations', async () => {
    const { app } = createFixture({ rateLimitMax: 1 });
    const send = () => request(app)
      .post('/api/admin/configurations/preview')
      .set(bearer('editor'))
      .set('X-CSRF-Token', csrf)
      .send({ configuration: createBaselineConfiguration() });
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
  });

  it('requires owner permission and recent authentication to publish', async () => {
    const { app, configurationService } = createFixture();
    const path = `/api/admin/configurations/${SELECTED_ID}/publish`;
    const send = (token: string) => request(app).post(path).set(bearer(token)).set('X-CSRF-Token', csrf).send({ expectedRowVersion: 1 });
    expect((await send('editor')).status).toBe(403);
    expect((await send('stale-owner')).status).toBe(403);
    expect((await send('owner')).status).toBe(200);
    expect(configurationService.publish).toHaveBeenCalledOnce();
  });

  it('runs sandbox through the pipeline without analytics or sensitive response fields', async () => {
    const { app, configurationService, tmdbService } = createFixture();
    const response = await request(app)
      .post('/api/admin/sandbox')
      .set(bearer('editor'))
      .set('X-CSRF-Token', csrf)
      .send({ configurationId: SELECTED_ID, examples: [{ description: 'private sandbox prompt', mediaType: 'movie' }] });
    expect(response.status).toBe(200);
    expect(tmdbService.getRecommendations).toHaveBeenCalledTimes(2);
    expect(configurationService.preview).toHaveBeenCalledOnce();
    expect(response.body.results[0]).toEqual({
      example: 1,
      active: { count: 1, items: [{ title: 'Safe title', mediaType: 'movie', availability: 'available', explanation: 'A concise reason this title suits the example.' }] },
      selected: { count: 1, items: [{ title: 'Safe title', mediaType: 'movie', availability: 'available', explanation: 'A concise reason this title suits the example.' }] },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/private sandbox prompt|Provider payload|posterUrl|tmdbMovieId/i);
  });

  it('keeps the isolated sandbox available to authorized editors in production', async () => {
    const { app, tmdbService } = createFixture({ nodeEnv: 'production' });
    const response = await request(app)
      .post('/api/admin/sandbox')
      .set(bearer('editor'))
      .set('X-CSRF-Token', csrf)
      .send({ configurationId: SELECTED_ID, examples: [{ description: 'test' }] });
    expect(response.status).toBe(200);
    expect(tmdbService.getRecommendations).toHaveBeenCalledTimes(2);
  });
});