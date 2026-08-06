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
import type { LibraryRepositoryLike, ListLibraryInput, StoredLibraryTitle } from './library-repository';
import { createLibraryRouter } from './library-router';
import type { TmdbService } from '../services/tmdb-service';

function createConfig(): AppConfig {
  return {
    port: 3001,
    nodeEnv: 'development',
    tmdbTimeoutMs: 8000,
    openAiModel: 'gpt-4.1-mini',
    openAiTimeoutMs: 8000,
    frontendOrigin: 'https://app.example.com',
    appBaseUrl: 'https://app.example.com',
    authCookieSameSite: 'lax',
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

class InMemoryLibraryRepository implements LibraryRepositoryLike {
  private rows = new Map<string, StoredLibraryTitle>();

  private key(userId: string, tmdbId: number, mediaType: 'movie' | 'tv') {
    return `${userId}:${mediaType}:${tmdbId}`;
  }

  async upsertWatchlist(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle> {
    const key = this.key(userId, tmdbId, mediaType);
    const existing = this.rows.get(key);
    const now = new Date();
    const next: StoredLibraryTitle = {
      user_library_title_id: existing?.user_library_title_id ?? `id-${key}`,
      user_id: userId,
      tmdb_id: tmdbId,
      media_type: mediaType,
      library_status: 'watchlist',
      added_at: existing?.added_at ?? now,
      watched_at: null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    this.rows.set(key, next);
    return next;
  }

  async markWatched(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle> {
    const key = this.key(userId, tmdbId, mediaType);
    const existing = this.rows.get(key);
    const now = new Date();
    const next: StoredLibraryTitle = {
      user_library_title_id: existing?.user_library_title_id ?? `id-${key}`,
      user_id: userId,
      tmdb_id: tmdbId,
      media_type: mediaType,
      library_status: 'watched',
      added_at: existing?.added_at ?? now,
      watched_at: existing?.watched_at ?? now,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    this.rows.set(key, next);
    return next;
  }

  async markUnwatched(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle> {
    return this.upsertWatchlist(userId, tmdbId, mediaType);
  }

  async removeTitle(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<boolean> {
    return this.rows.delete(this.key(userId, tmdbId, mediaType));
  }

  async getTitle(userId: string, tmdbId: number, mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle | null> {
    return this.rows.get(this.key(userId, tmdbId, mediaType)) ?? null;
  }

  async listLibrary(userId: string, input: ListLibraryInput): Promise<{ rows: StoredLibraryTitle[]; total: number }> {
    const filtered = [...this.rows.values()]
      .filter((row) => row.user_id === userId && row.library_status === input.status)
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

    const start = (input.page - 1) * input.pageSize;
    return {
      total: filtered.length,
      rows: filtered.slice(start, start + input.pageSize),
    };
  }

  async listStates(userId: string, titles: Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>): Promise<StoredLibraryTitle[]> {
    return titles
      .map((title) => this.rows.get(this.key(userId, title.tmdbId, title.mediaType)))
      .filter((row): row is StoredLibraryTitle => Boolean(row));
  }

  async listWatchedTitleIds(userId: string, mediaType: 'movie' | 'tv', limit = 300): Promise<number[]> {
    return [...this.rows.values()]
      .filter((row) => row.user_id === userId && row.media_type === mediaType && row.library_status === 'watched')
      .slice(0, limit)
      .map((row) => row.tmdb_id);
  }

  async clearWatchlist(userId: string): Promise<number> {
    let removed = 0;
    for (const [key, row] of this.rows.entries()) {
      if (row.user_id === userId && row.library_status === 'watchlist') {
        this.rows.delete(key);
        removed++;
      }
    }
    return removed;
  }

  async clearWatched(userId: string): Promise<number> {
    let removed = 0;
    for (const [key, row] of this.rows.entries()) {
      if (row.user_id === userId && row.library_status === 'watched') {
        this.rows.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

class StubTmdbService {
  async getTitleSummaries(titles: Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>) {
    return titles.map((title) => ({
      tmdbMovieId: title.tmdbId,
      mediaType: title.mediaType,
      title: `Title ${title.tmdbId}`,
      posterUrl: '',
      releaseYear: 2024,
      runtimeMinutes: 100,
      tmdbRating: 7,
      genres: [],
      providers: [],
      country: '',
    }));
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

describe('library router', () => {
  const config = createConfig();
  let authRepo: InMemoryAuthRepository;
  let libraryRepo: InMemoryLibraryRepository;
  let app: express.Express;

  beforeEach(() => {
    authRepo = new InMemoryAuthRepository();
    libraryRepo = new InMemoryLibraryRepository();
    app = express();
    app.use(express.json());
    app.use('/api/library', createLibraryRouter(config, authRepo, libraryRepo, new StubTmdbService() as unknown as TmdbService));
  });

  it('returns 401 for anonymous library access', async () => {
    const res = await request(app).get('/api/library/watchlist').set('Origin', 'https://app.example.com');
    expect(res.status).toBe(401);
  });

  it('adds idempotent watchlist entries and preserves one record per user/title/media', async () => {
    const session = createAuthenticatedSession(authRepo, config, 'u1');

    const first = await request(app)
      .post('/api/library/action')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 123, mediaType: 'movie', action: 'add_watchlist' });

    const second = await request(app)
      .post('/api/library/action')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 123, mediaType: 'movie', action: 'add_watchlist' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const list = await request(app)
      .get('/api/library/watchlist?page=1&pageSize=20')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie);

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.headers['cache-control']).toBe('private, no-store');
  });

  it('supports watched transitions and clear operations without cross-user leakage', async () => {
    const userA = createAuthenticatedSession(authRepo, config, 'u-a');
    const userB = createAuthenticatedSession(authRepo, config, 'u-b');

    await request(app)
      .post('/api/library/action')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ tmdbId: 10, mediaType: 'movie', action: 'mark_watched' });

    await request(app)
      .post('/api/library/action')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ tmdbId: 10, mediaType: 'movie', action: 'mark_unwatched' });

    const listA = await request(app)
      .get('/api/library/watchlist')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', userA.cookie);

    const listB = await request(app)
      .get('/api/library/watchlist')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', userB.cookie);

    expect(listA.body.total).toBe(1);
    expect(listB.body.total).toBe(0);

    const clear = await request(app)
      .delete('/api/library/watchlist')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', userA.cookie)
      .set('X-CSRF-Token', userA.csrfToken);

    expect(clear.status).toBe(200);
    expect(clear.body.ok).toBe(true);
  });

  it('rejects invalid media type and unsupported fields', async () => {
    const session = createAuthenticatedSession(authRepo, config, 'u1');

    const invalidMedia = await request(app)
      .post('/api/library/action')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 1, mediaType: 'bad', action: 'add_watchlist' });

    const unsupported = await request(app)
      .post('/api/library/action')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 1, mediaType: 'movie', action: 'add_watchlist', userId: 'attack' });

    expect(invalidMedia.status).toBe(400);
    expect(unsupported.status).toBe(400);
  });

  it('keeps movie and tv identities separate', async () => {
    const session = createAuthenticatedSession(authRepo, config, 'u1');

    await request(app)
      .post('/api/library/action')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 55, mediaType: 'movie', action: 'add_watchlist' });

    await request(app)
      .post('/api/library/action')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ tmdbId: 55, mediaType: 'tv', action: 'add_watchlist' });

    const states = await request(app)
      .post('/api/library/states')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .send({ titles: [{ tmdbId: 55, mediaType: 'movie' }, { tmdbId: 55, mediaType: 'tv' }] });

    expect(states.status).toBe(200);
    expect(states.body.states).toHaveLength(2);
  });
});
