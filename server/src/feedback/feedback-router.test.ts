import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { AUTH_SESSION_COOKIE_NAME, createCsrfToken, createSessionToken, hashSessionToken } from '../auth/auth-crypto';
import type {
  AuthRepositoryLike,
  SessionWithUser,
  StoredEmailVerificationToken,
  StoredPasswordResetToken,
  StoredProfileSeed,
  StoredSession,
  StoredUser,
} from '../auth/auth-repository';
import type { AppConfig } from '../config/env';
import { createFeedbackRouter } from './feedback-router';
import type { FeedbackEntry } from '../recommendations/taste-signals';
import type { FeedbackRepositoryLike, StoredFeedback, StoredFeedbackType } from './feedback-repository';

function createConfig(): AppConfig {
  return {
    port: 3001,
    nodeEnv: 'development',
    tmdbTimeoutMs: 8000,
    openAiModel: 'gpt-4.1-mini',
    openAiTimeoutMs: 8000,
    frontendOrigin: 'https://app.example.com',
    appBaseUrl: 'https://app.example.com',
    authCookieSameSite: 'none',
    emailProvider: 'console',
    emailTokenPepper: 'y'.repeat(32),
    database: null,
    sessionTokenPepper: 'x'.repeat(32),
  };
}

class InMemoryAuthRepository implements AuthRepositoryLike {
  users = new Map<string, StoredUser>();
  sessions = new Map<string, StoredSession>();
  profiles = new Map<string, StoredProfileSeed>();

  async withTransaction<T>(op: (r: AuthRepositoryLike) => Promise<T>): Promise<T> { return op(this); }
  async findUserByEmail(email: string) { return [...this.users.values()].find((u) => u.email === email) ?? null; }
  async findUserById(id: string) { return this.users.get(id) ?? null; }
  async createUser(user: StoredUser) { this.users.set(user.user_id, user); }
  async createProfile(profile: StoredProfileSeed) { this.profiles.set(profile.user_id, profile); }
  async updateUserEmailVerification(userId: string, emailVerifiedAt: Date, accountStatus: StoredUser['account_status']) {
    const user = this.users.get(userId);
    if (user) {
      user.email_verified_at = emailVerifiedAt;
      user.account_status = accountStatus;
      user.updated_at = new Date();
    }
  }
  async updateUserPasswordHash(userId: string, passwordHash: string) {
    const user = this.users.get(userId);
    if (user) {
      user.password_hash = passwordHash;
      user.updated_at = new Date();
    }
  }
  async createSession(session: Omit<StoredSession, 'revoked_at'>) { this.sessions.set(session.session_id, { ...session, revoked_at: null }); }
  async findActiveSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | null> {
    const session = [...this.sessions.values()].find((s) => s.token_hash === tokenHash && s.revoked_at === null && s.expires_at.getTime() > Date.now());
    if (!session) return null;
    const user = this.users.get(session.user_id);
    if (!user) return null;
    return {
      ...session,
      user_email: user.email,
      user_email_verified_at: user.email_verified_at,
      user_account_status: user.account_status,
      user_created_at: user.created_at,
      user_updated_at: user.updated_at,
    };
  }
  async touchSessionLastUsedAt(_sessionId: string, _threshold: Date) {}
  async revokeSession(_sessionId: string) {}
  async revokeAllSessionsForUser(_userId: string) { return 0; }
  async createEmailVerificationToken(_token: Omit<StoredEmailVerificationToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }) {}
  async findEmailVerificationTokenByHash(_tokenHash: string): Promise<StoredEmailVerificationToken | null> { return null; }
  async markEmailVerificationTokenUsed(_tokenId: string) {}
  async invalidateEmailVerificationTokensForUser(_userId: string) {}
  async createPasswordResetToken(_token: Omit<StoredPasswordResetToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }) {}
  async findPasswordResetTokenByHash(_tokenHash: string): Promise<StoredPasswordResetToken | null> { return null; }
  async markPasswordResetTokenUsed(_tokenId: string) {}
  async invalidatePasswordResetTokensForUser(_userId: string) {}
}

class InMemoryFeedbackRepository implements FeedbackRepositoryLike {
  private data = new Map<string, StoredFeedback>();

  private key(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): string {
    return `${userId}:${mediaType}:${tmdbId}`;
  }

  async upsertFeedback(
    userId: string,
    tmdbId: number,
    mediaType: 'movie' | 'tv',
    feedbackType: StoredFeedbackType,
    meta?: { genresJson?: string | null; originalLanguage?: string | null },
  ): Promise<StoredFeedback> {
    const key = this.key(userId, tmdbId, mediaType);
    const current = this.data.get(key);
    const now = new Date();
    const next: StoredFeedback = {
      user_title_feedback_id: current?.user_title_feedback_id ?? `feedback-${key}`,
      user_id: userId,
      tmdb_id: tmdbId,
      media_type: mediaType,
      feedback_type: feedbackType,
      genres_json: meta?.genresJson ?? current?.genres_json ?? null,
      original_language: meta?.originalLanguage ?? current?.original_language ?? null,
      created_at: current?.created_at ?? now,
      updated_at: now,
    };
    this.data.set(key, next);
    return next;
  }

  async removeFeedback(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<boolean> {
    return this.data.delete(this.key(userId, tmdbId, mediaType));
  }

  async getFeedback(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredFeedback | null> {
    return this.data.get(this.key(userId, tmdbId, mediaType)) ?? null;
  }

  async listFeedback(userId: string): Promise<StoredFeedback[]> {
    return [...this.data.values()].filter((row) => row.user_id === userId);
  }

  async listRatedTitleKeys(_userId: string, _limit = 200): Promise<Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>> {
    return [];
  }

  async listFeedbackForSignals(_userId: string): Promise<FeedbackEntry[]> {
    return [];
  }

  async clearAllFeedback(userId: string): Promise<number> {
    const before = this.data.size;
    for (const [key, row] of this.data.entries()) {
      if (row.user_id === userId) this.data.delete(key);
    }
    return before - this.data.size;
  }
}

function createAuthenticatedSession(repo: InMemoryAuthRepository, config: AppConfig, userId: string) {
  const now = new Date();
  repo.users.set(userId, {
    user_id: userId,
    email: `${userId}@example.com`,
    password_hash: 'ignored',
    email_verified_at: now,
    account_status: 'active',
    created_at: now,
    updated_at: now,
  });

  const token = createSessionToken();
  const hash = hashSessionToken(token, config.sessionTokenPepper ?? '');
  repo.sessions.set(`sess-${userId}`, {
    session_id: `sess-${userId}`,
    user_id: userId,
    token_hash: hash,
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
    revoked_at: null,
    created_at: now,
    last_used_at: null,
    device_label: 'test-device',
    client_platform: 'web',
  });

  return {
    cookie: `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    csrfToken: createCsrfToken(hash, config.sessionTokenPepper ?? ''),
  };
}

describe('feedback router', () => {
  let authRepo: InMemoryAuthRepository;
  let feedbackRepo: InMemoryFeedbackRepository;
  let app: express.Express;
  const config = createConfig();

  beforeEach(() => {
    authRepo = new InMemoryAuthRepository();
    feedbackRepo = new InMemoryFeedbackRepository();
    app = express();
    app.use(express.json());
    app.use('/api/feedback', createFeedbackRouter(config, authRepo, feedbackRepo));
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/feedback').set('Origin', 'https://app.example.com');
    expect(res.status).toBe(401);
  });

  it('creates and updates feedback idempotently for the same title', async () => {
    const session = createAuthenticatedSession(authRepo, config, '11111111-1111-4111-8111-111111111111');

    const createRes = await request(app)
      .post('/api/feedback')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 99, mediaType: 'movie', feedbackType: 'liked', genres: ['Comedy'], originalLanguage: 'fr' });

    expect(createRes.status).toBe(200);
    expect(createRes.body.feedback.feedbackType).toBe('liked');

    const updateRes = await request(app)
      .post('/api/feedback')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 99, mediaType: 'movie', feedbackType: 'disliked' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.feedback.feedbackType).toBe('disliked');

    const listRes = await request(app)
      .get('/api/feedback')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.feedback).toHaveLength(1);
  });

  it('supports remove and clear operations', async () => {
    const session = createAuthenticatedSession(authRepo, config, '11111111-1111-4111-8111-111111111111');

    await request(app)
      .post('/api/feedback')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 1, mediaType: 'movie', feedbackType: 'liked' });

    await request(app)
      .post('/api/feedback')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 2, mediaType: 'tv', feedbackType: 'watched' });

    const removeRes = await request(app)
      .delete('/api/feedback/1/movie')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken);

    expect(removeRes.status).toBe(200);

    const clearRes = await request(app)
      .delete('/api/feedback')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.ok).toBe(true);
  });

  it('scopes reads to the authenticated user', async () => {
    const userA = createAuthenticatedSession(authRepo, config, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const userB = createAuthenticatedSession(authRepo, config, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

    await request(app)
      .post('/api/feedback')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ tmdbId: 77, mediaType: 'movie', feedbackType: 'liked' });

    const listB = await request(app)
      .get('/api/feedback')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', userB.cookie);

    expect(listB.status).toBe(200);
    expect(listB.body.feedback).toHaveLength(0);
  });

  it('rejects invalid media type', async () => {
    const session = createAuthenticatedSession(authRepo, config, '11111111-1111-4111-8111-111111111111');

    const res = await request(app)
      .post('/api/feedback')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 99, mediaType: 'bad-type', feedbackType: 'liked' });

    expect(res.status).toBe(400);
  });
});
