import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/env';
import { AUTH_SESSION_COOKIE_NAME, createCsrfToken, createSessionToken, hashSessionToken } from '../auth/auth-crypto';
import type {
  AuthRepositoryLike,
  StoredProfileSeed,
  SessionWithUser,
  StoredEmailVerificationToken,
  StoredPasswordResetToken,
  StoredSession,
  StoredUser,
} from '../auth/auth-repository';
import { createProfileRouter } from './profile-router';
import type { ContentLanguageSelection, ProfileRepositoryLike, ReplacePreferencesInput, StoredProfile, UpsertProfileInput } from './profile-repository';

class InMemoryAuthRepository implements AuthRepositoryLike {
  users = new Map<string, StoredUser>();

  sessions = new Map<string, StoredSession>();

  profiles = new Map<string, StoredProfileSeed>();

  async withTransaction<T>(operation: (repository: AuthRepositoryLike) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findUserById(userId: string): Promise<StoredUser | null> {
    return this.users.get(userId) ?? null;
  }

  async createUser(user: StoredUser): Promise<void> {
    this.users.set(user.user_id, user);
  }

  async createProfile(profile: StoredProfileSeed): Promise<void> {
    this.profiles.set(profile.user_id, profile);
  }

  async updateUserEmailVerification(userId: string, emailVerifiedAt: Date, accountStatus: StoredUser['account_status']): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.email_verified_at = emailVerifiedAt;
      user.account_status = accountStatus;
      user.updated_at = new Date();
    }
  }

  async updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.password_hash = passwordHash;
      user.updated_at = new Date();
    }
  }

  async createSession(session: Omit<StoredSession, 'revoked_at'>): Promise<void> {
    this.sessions.set(session.session_id, { ...session, revoked_at: null });
  }

  async findActiveSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | null> {
    const session = [...this.sessions.values()].find(
      (currentSession) =>
        currentSession.token_hash === tokenHash &&
        currentSession.revoked_at === null &&
        currentSession.expires_at.getTime() > Date.now(),
    );

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

  async touchSessionLastUsedAt(sessionId: string, threshold: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && (!session.last_used_at || session.last_used_at < threshold)) {
      session.last_used_at = new Date();
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) session.revoked_at = new Date();
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.user_id === userId && session.revoked_at === null) {
        session.revoked_at = new Date();
        count += 1;
      }
    }
    return count;
  }

  async createEmailVerificationToken(_token: Omit<StoredEmailVerificationToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void> {}
  async findEmailVerificationTokenByHash(_tokenHash: string): Promise<StoredEmailVerificationToken | null> { return null; }
  async markEmailVerificationTokenUsed(_tokenId: string): Promise<void> {}
  async invalidateEmailVerificationTokensForUser(_userId: string): Promise<void> {}
  async createPasswordResetToken(_token: Omit<StoredPasswordResetToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void> {}
  async findPasswordResetTokenByHash(_tokenHash: string): Promise<StoredPasswordResetToken | null> { return null; }
  async markPasswordResetTokenUsed(_tokenId: string): Promise<void> {}
  async invalidatePasswordResetTokensForUser(_userId: string): Promise<void> {}
}

class InMemoryProfileRepository implements ProfileRepositoryLike {
  profiles = new Map<string, StoredProfile>();
  streamingServices = new Map<string, Array<{ providerId: number; providerName: string }>>();
  contentLanguages = new Map<string, ContentLanguageSelection[]>();

  async findByUserId(userId: string): Promise<StoredProfile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async upsert(userId: string, input: UpsertProfileInput): Promise<StoredProfile> {
    const profile: StoredProfile = {
      user_id: userId,
      first_name: input.firstName,
      last_name: input.lastName,
      display_name: input.displayName,
      country_code: input.countryCode,
      viewing_format_preference: input.viewingFormatPreference ?? null,
      avatar_url: input.avatarUrl,
      letterboxd_username: input.letterboxdUsername,
      letterboxd_profile_url: input.letterboxdProfileUrl,
      tvtime_username: input.tvtimeUsername,
      tvtime_profile_url: input.tvtimeProfileUrl,
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  async listStreamingServices(userId: string): Promise<Array<{ providerId: number; providerName: string }>> {
    return this.streamingServices.get(userId) ?? [];
  }

  async replaceStreamingServices(userId: string, _countryCode: string, services: Array<{ providerId: number; providerName: string }>): Promise<Array<{ providerId: number; providerName: string }>> {
    this.streamingServices.set(userId, services);
    return services;
  }

  async listContentLanguages(userId: string): Promise<ContentLanguageSelection[]> {
    return this.contentLanguages.get(userId) ?? [];
  }

  async replaceContentLanguages(userId: string, languageCodes: string[]): Promise<ContentLanguageSelection[]> {
    const selections = languageCodes.map((code, index) => ({ languageCode: code, sortOrder: index }));
    this.contentLanguages.set(userId, selections);
    return selections;
  }

  async replacePreferences(userId: string, input: ReplacePreferencesInput): Promise<void> {
    const existing = this.profiles.get(userId);
    if (existing) {
      existing.country_code = input.marketCode;
      existing.viewing_format_preference = input.viewingFormatPreference;
    }
    this.streamingServices.set(userId, input.services);
    const selections = input.languageCodes.map((code, index) => ({ languageCode: code, sortOrder: index }));
    this.contentLanguages.set(userId, selections);
  }
}

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

function createAuthenticatedSession(repo: InMemoryAuthRepository, config: AppConfig): { cookie: string; csrfToken: string; userId: string } {
  const now = new Date();
  const userId = '11111111-1111-4111-8111-111111111111';
  repo.users.set(userId, {
    user_id: userId,
    email: 'user@example.com',
    password_hash: 'ignored',
    email_verified_at: now,
    account_status: 'active',
    created_at: now,
    updated_at: now,
  });

  const sessionToken = createSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken, config.sessionTokenPepper ?? '');
  repo.sessions.set('22222222-2222-4222-8222-222222222222', {
    session_id: '22222222-2222-4222-8222-222222222222',
    user_id: userId,
    token_hash: sessionTokenHash,
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
    revoked_at: null,
    created_at: now,
    last_used_at: null,
    device_label: 'test-device',
    client_platform: 'web',
  });

  return {
    cookie: `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    csrfToken: createCsrfToken(sessionTokenHash, config.sessionTokenPepper ?? ''),
    userId,
  };
}

function createApp(authRepo: InMemoryAuthRepository, profileRepo: InMemoryProfileRepository) {
  const app = express();
  app.use(express.json());
  app.use('/api/profile', createProfileRouter(createConfig(), authRepo, profileRepo));
  return app;
}

describe('profile router', () => {
  let authRepo: InMemoryAuthRepository;
  let profileRepo: InMemoryProfileRepository;
  let app: express.Express;

  beforeEach(() => {
    authRepo = new InMemoryAuthRepository();
    profileRepo = new InMemoryProfileRepository();
    app = createApp(authRepo, profileRepo);
  });

  it('returns 401 without session cookie', async () => {
    const response = await request(app).get('/api/profile').set('Origin', 'https://app.example.com');
    expect(response.status).toBe(401);
  });

  it('returns null when no profile exists', async () => {
    const session = createAuthenticatedSession(authRepo, createConfig());
    const response = await request(app).get('/api/profile').set('Origin', 'https://app.example.com').set('Cookie', session.cookie);
    expect(response.status).toBe(200);
    expect(response.body.profile).toBeNull();
  });

  it('requires csrf for profile updates', async () => {
    const session = createAuthenticatedSession(authRepo, createConfig());
    const response = await request(app)
      .patch('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .send({ firstName: 'James', lastName: 'Narvey', displayName: 'James', countryCode: 'US' });
    expect(response.status).toBe(403);
  });

  it('upserts profile and returns normalized payload', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const patchResponse = await request(app)
      .patch('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ firstName: 'James', lastName: 'Narvey', displayName: 'James AI', countryCode: 'us', avatarUrl: 'https://example.com/avatar.png', letterboxdUsername: 'jamesletter' });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.profile.firstName).toBe('James');
    expect(patchResponse.body.profile.countryCode).toBe('US');

    const getResponse = await request(app).get('/api/profile').set('Origin', 'https://app.example.com').set('Cookie', session.cookie);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.profile.displayName).toBe('James AI');
    expect(getResponse.body.profile.tvtimeUsername).toBeNull();
  });

  it('loads and updates streaming services', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const patchResponse = await request(app)
      .patch('/api/profile/streaming-services')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ providerIds: [8, 9] });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.services).toEqual([
      { providerId: 8, providerName: 'Netflix' },
      { providerId: 9, providerName: 'Prime Video' },
    ]);

    const getResponse = await request(app).get('/api/profile/streaming-services').set('Origin', 'https://app.example.com').set('Cookie', session.cookie);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.catalog.length).toBeGreaterThan(0);
  });

  it('saves and retrieves content language preferences', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const emptyResponse = await request(app)
      .get('/api/profile/content-languages')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie);
    expect(emptyResponse.status).toBe(200);
    expect(emptyResponse.body.languages).toEqual([]);

    const patchResponse = await request(app)
      .patch('/api/profile/content-languages')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ languageCodes: ['fr', 'en', 'es'] });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.languages).toHaveLength(3);
    expect(patchResponse.body.languages[0].languageCode).toBe('fr');
    expect(patchResponse.body.languages[0].sortOrder).toBe(0);
    expect(patchResponse.body.languages[2].languageCode).toBe('es');
    expect(patchResponse.body.languages[2].sortOrder).toBe(2);

    const getResponse = await request(app)
      .get('/api/profile/content-languages')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.languages).toHaveLength(3);
  });

  it('rejects anonymous content-language access', async () => {
    const response = await request(app)
      .get('/api/profile/content-languages')
      .set('Origin', 'https://app.example.com');
    expect(response.status).toBe(401);
  });

  it('rejects unsupported language codes', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const response = await request(app)
      .patch('/api/profile/content-languages')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ languageCodes: ['xx', 'zz'] });

    expect(response.status).toBe(400);
  });

  it('deduplicates language codes', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const response = await request(app)
      .patch('/api/profile/content-languages')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ languageCodes: ['en', 'fr', 'en'] });

    expect(response.status).toBe(200);
    expect(response.body.languages).toHaveLength(2);
  });

  it('accepts empty language array as "any language"', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const response = await request(app)
      .patch('/api/profile/content-languages')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ languageCodes: [] });

    expect(response.status).toBe(200);
    expect(response.body.languages).toEqual([]);
  });

  it('saves preferences atomically via /preferences endpoint', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    // Create profile so replacePreferences can find it
    profileRepo.profiles.set(session.userId, {
      user_id: session.userId,
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      country_code: 'US',
      viewing_format_preference: null,
      avatar_url: null,
      letterboxd_username: null,
      letterboxd_profile_url: null,
      tvtime_username: null,
      tvtime_profile_url: null,
    });

    const patchResponse = await request(app)
      .patch('/api/profile/preferences')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        marketCode: 'GB',
        providerIds: [8, 337],
        languageCodes: ['en', 'fr'],
        viewingFormatPreference: 'subtitles_ok',
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.marketCode).toBe('GB');
    expect(patchResponse.body.streamingServices).toHaveLength(2);
    expect(patchResponse.body.contentLanguages).toHaveLength(2);
    expect(patchResponse.body.viewingFormatPreference).toBe('subtitles_ok');
  });

  it('rejects unsupported market codes in preferences', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const response = await request(app)
      .patch('/api/profile/preferences')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ marketCode: 'XX', providerIds: [], languageCodes: [], viewingFormatPreference: null });

    expect(response.status).toBe(400);
  });

  it('rejects unsupported provider IDs in preferences', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const response = await request(app)
      .patch('/api/profile/preferences')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ marketCode: 'US', providerIds: [99999], languageCodes: [], viewingFormatPreference: null });

    expect(response.status).toBe(400);
  });

  it('returns reference data without authentication', async () => {
    const response = await request(app).get('/api/profile/reference').set('Origin', 'https://app.example.com');
    expect(response.status).toBe(200);
    expect(response.body.countries.length).toBeGreaterThan(0);
    expect(response.body.languages.length).toBeGreaterThan(0);
    expect(response.body.providers.length).toBeGreaterThan(0);
    expect(response.body.countries[0]).toHaveProperty('code');
    expect(response.body.countries[0]).toHaveProperty('name');
  });

  it('profile data is isolated between users', async () => {
    const config = createConfig();
    const now = new Date();
    const userId2 = '33333333-3333-4333-8333-333333333333';
    authRepo.users.set(userId2, {
      user_id: userId2,
      email: 'other@example.com',
      password_hash: 'ignored',
      email_verified_at: now,
      account_status: 'active',
      created_at: now,
      updated_at: now,
    });
    const sessionToken2 = createSessionToken();
    const sessionTokenHash2 = hashSessionToken(sessionToken2, config.sessionTokenPepper ?? '');
    authRepo.sessions.set('44444444-4444-4444-8444-444444444444', {
      session_id: '44444444-4444-4444-8444-444444444444',
      user_id: userId2,
      token_hash: sessionTokenHash2,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      revoked_at: null,
      created_at: now,
      last_used_at: null,
      device_label: 'test-device-2',
      client_platform: 'web',
    });
    const cookie2 = `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken2)}`;

    const session1 = createAuthenticatedSession(authRepo, config);

    await request(app)
      .patch('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session1.cookie)
      .set('X-CSRF-Token', session1.csrfToken)
      .send({ firstName: 'Alice', lastName: 'One', displayName: 'Alice', countryCode: 'US' });

    const user2Profile = await request(app).get('/api/profile').set('Origin', 'https://app.example.com').set('Cookie', cookie2);
    expect(user2Profile.status).toBe(200);
    expect(user2Profile.body.profile).toBeNull();
  });
});
