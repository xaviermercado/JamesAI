import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createCsrfToken } from '../auth/auth-crypto';
import type { AuthSessionResponse, SafeUser } from '../auth/auth-types';
import {
  createAdminAuthorization,
  RECENT_REAUTHENTICATION_WINDOW_MS,
  type AdminAuthSessionService,
} from './admin-authorization';

const SESSION_TOKEN_HASH = 'a'.repeat(64);
const SESSION_PEPPER = 'test-pepper';
const NOW = new Date('2026-08-07T12:00:00.000Z');

function authenticatedSession(
  adminRole: SafeUser['adminRole'],
  authenticatedAt = NOW.toISOString(),
  accountStatus: SafeUser['accountStatus'] = 'active',
): AuthSessionResponse & { identity: NonNullable<Awaited<ReturnType<AdminAuthSessionService['restoreSession']>>['identity']> } {
  return {
    authenticated: true,
    user: {
      userId: 'user-1',
      email: 'admin@example.com',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      accountStatus,
      adminRole,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    csrfToken: createCsrfToken(SESSION_TOKEN_HASH, SESSION_PEPPER),
    authenticatedAt,
    identity: {
      userId: 'user-1',
      sessionId: 'session-1',
      sessionTokenHash: SESSION_TOKEN_HASH,
      csrfToken: createCsrfToken(SESSION_TOKEN_HASH, SESSION_PEPPER),
      expiresAt: '2026-08-08T12:00:00.000Z',
      authenticatedAt,
    },
  };
}

function createTestApp(restored: Awaited<ReturnType<AdminAuthSessionService['restoreSession']>>) {
  const authService: AdminAuthSessionService = {
    restoreSession: vi.fn().mockResolvedValue(restored),
  };
  const authorization = createAdminAuthorization(authService, { sessionTokenPepper: SESSION_PEPPER }, { now: () => NOW });
  const app = express();
  app.use(express.json());
  app.get('/insights', authorization.requireCapability('view_insights'), (_req, res) => {
    res.json({ role: authorization.getContext(res)?.user.adminRole });
  });
  app.get('/invalid', authorization.requireCapability('not_a_capability'), (_req, res) => res.json({ ok: true }));
  app.post('/draft', authorization.requireCapability('edit_configuration'), (_req, res) => res.json({ ok: true }));
  app.post('/publish', authorization.requireCapability('publish_configuration'), (_req, res) => res.json({ ok: true }));
  return app;
}

const bearer = { Authorization: 'Bearer raw-session-token' };

describe('admin authorization', () => {
  it('returns 401 when no session token is present', async () => {
    const response = await request(createTestApp(authenticatedSession('editor'))).get('/insights');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when session restoration fails', async () => {
    const response = await request(createTestApp({ authenticated: false, user: null, csrfToken: null, authenticatedAt: null }))
      .get('/insights')
      .set(bearer);
    expect(response.status).toBe(401);
  });

  it('returns 403 for an invalid capability or insufficient role', async () => {
    const app = createTestApp(authenticatedSession('user'));
    expect((await request(app).get('/invalid').set(bearer)).status).toBe(403);
    expect((await request(app).get('/insights').set(bearer)).status).toBe(403);
  });

  it('returns 403 when an administrator account is no longer active', async () => {
    const response = await request(createTestApp(authenticatedSession('owner', NOW.toISOString(), 'disabled')))
      .get('/insights')
      .set(bearer);
    expect(response.status).toBe(403);
  });

  it('restores an editor identity and exposes authorization context', async () => {
    const response = await request(createTestApp(authenticatedSession('editor'))).get('/insights').set(bearer);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ role: 'editor' });
  });

  it('requires the existing CSRF token scheme for mutations', async () => {
    const app = createTestApp(authenticatedSession('editor'));
    expect((await request(app).post('/draft').set(bearer)).status).toBe(403);

    const response = await request(app)
      .post('/draft')
      .set(bearer)
      .set('X-CSRF-Token', createCsrfToken(SESSION_TOKEN_HASH, SESSION_PEPPER));
    expect(response.status).toBe(200);
  });

  it('requires reauthentication within 15 minutes for high-impact actions', async () => {
    const csrfToken = createCsrfToken(SESSION_TOKEN_HASH, SESSION_PEPPER);
    const recentAt = new Date(NOW.getTime() - RECENT_REAUTHENTICATION_WINDOW_MS).toISOString();
    const staleAt = new Date(NOW.getTime() - RECENT_REAUTHENTICATION_WINDOW_MS - 1).toISOString();

    const recentResponse = await request(createTestApp(authenticatedSession('owner', recentAt)))
      .post('/publish')
      .set(bearer)
      .set('X-CSRF-Token', csrfToken);
    const staleResponse = await request(createTestApp(authenticatedSession('owner', staleAt)))
      .post('/publish')
      .set(bearer)
      .set('X-CSRF-Token', csrfToken);

    expect(recentResponse.status).toBe(200);
    expect(staleResponse.status).toBe(403);
  });
});