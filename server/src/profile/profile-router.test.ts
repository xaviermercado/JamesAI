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
import type { LetterboxdRepositoryLike, LetterboxdSeenTitleKey, StoredLetterboxdSettings } from '../letterboxd/letterboxd-repository';
import { createProfileRouter } from './profile-router';
import { scoutyAvatarCatalog } from './avatar-catalog';
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
  streamingServices = new Map<string, Array<{ providerId: number; providerName: string; sortOrder: number }>>();
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
      personalization_enabled: 1,
      avatar_url: null,
      avatar_id: input.avatarId ?? null,
      letterboxd_username: input.letterboxdUsername,
      letterboxd_profile_url: null,
      tvtime_username: input.tvtimeUsername,
      tvtime_profile_url: null,
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  async listStreamingServices(userId: string): Promise<Array<{ providerId: number; providerName: string; sortOrder: number }>> {
    return this.streamingServices.get(userId) ?? [];
  }

  async replaceStreamingServices(userId: string, _countryCode: string, services: Array<{ providerId: number; providerName: string; sortOrder: number }>): Promise<Array<{ providerId: number; providerName: string; sortOrder: number }>> {
    const normalized = services.map((service, index) => ({ ...service, sortOrder: index }));
    this.streamingServices.set(userId, normalized);
    return normalized;
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
      if (typeof input.personalizationEnabled === 'boolean') {
        existing.personalization_enabled = input.personalizationEnabled ? 1 : 0;
      }
    }
    this.streamingServices.set(userId, input.services.map((service, index) => ({ ...service, sortOrder: index })));
    const selections = input.languageCodes.map((code, index) => ({ languageCode: code, sortOrder: index }));
    this.contentLanguages.set(userId, selections);
  }
}

class InMemoryLetterboxdRepository implements LetterboxdRepositoryLike {
  settingsByUser = new Map<string, StoredLetterboxdSettings>();
  titleCountsByUser = new Map<string, { rssCount: number; exportCount: number }>();
  seenByUser = new Map<string, LetterboxdSeenTitleKey[]>();
  nextRefreshMode: 'ok' | 'error' | 'not_modified' = 'ok';

  async getSettings(userId: string): Promise<StoredLetterboxdSettings | null> {
    return this.settingsByUser.get(userId) ?? null;
  }

  async setPublicActivityEnabled(userId: string, enabled: boolean): Promise<StoredLetterboxdSettings> {
    const existing = this.settingsByUser.get(userId);
    const next: StoredLetterboxdSettings = {
      user_id: userId,
      public_activity_enabled: enabled ? 1 : 0,
      rss_status: existing?.rss_status ?? 'idle',
      rss_last_checked_at: existing?.rss_last_checked_at ?? null,
      rss_last_success_at: existing?.rss_last_success_at ?? null,
      rss_last_error_code: existing?.rss_last_error_code ?? null,
      rss_last_error_message: existing?.rss_last_error_message ?? null,
      rss_etag: existing?.rss_etag ?? null,
      rss_last_modified: existing?.rss_last_modified ?? null,
    };
    this.settingsByUser.set(userId, next);
    return next;
  }

  async markRssNotModified(userId: string, metadata: { etag?: string | null; lastModified?: string | null }): Promise<void> {
    const current = this.settingsByUser.get(userId);
    this.settingsByUser.set(userId, {
      user_id: userId,
      public_activity_enabled: current?.public_activity_enabled ?? 1,
      rss_status: 'ok',
      rss_last_checked_at: new Date(),
      rss_last_success_at: new Date(),
      rss_last_error_code: null,
      rss_last_error_message: null,
      rss_etag: metadata.etag ?? current?.rss_etag ?? null,
      rss_last_modified: metadata.lastModified ?? current?.rss_last_modified ?? null,
    });
  }

  async replaceRssTitles(userId: string, titles: Array<{ normalizedTitle: string; releaseYear: number | null }>, metadata: { etag?: string | null; lastModified?: string | null }): Promise<void> {
    this.seenByUser.set(
      userId,
      titles.map((item) => ({ normalizedTitle: item.normalizedTitle, releaseYear: item.releaseYear })),
    );
    const counts = this.titleCountsByUser.get(userId) ?? { rssCount: 0, exportCount: 0 };
    this.titleCountsByUser.set(userId, { ...counts, rssCount: titles.length });

    const current = this.settingsByUser.get(userId);
    this.settingsByUser.set(userId, {
      user_id: userId,
      public_activity_enabled: current?.public_activity_enabled ?? 1,
      rss_status: 'ok',
      rss_last_checked_at: new Date(),
      rss_last_success_at: new Date(),
      rss_last_error_code: null,
      rss_last_error_message: null,
      rss_etag: metadata.etag ?? null,
      rss_last_modified: metadata.lastModified ?? null,
    });
  }

  async markRssError(userId: string, code: string, message: string): Promise<void> {
    const current = this.settingsByUser.get(userId);
    this.settingsByUser.set(userId, {
      user_id: userId,
      public_activity_enabled: current?.public_activity_enabled ?? 1,
      rss_status: 'error',
      rss_last_checked_at: new Date(),
      rss_last_success_at: current?.rss_last_success_at ?? null,
      rss_last_error_code: code,
      rss_last_error_message: message,
      rss_etag: current?.rss_etag ?? null,
      rss_last_modified: current?.rss_last_modified ?? null,
    });
  }

  async replaceExportTitles(_userId: string): Promise<void> {}

  async clearExportTitles(userId: string): Promise<number> {
    const counts = this.titleCountsByUser.get(userId) ?? { rssCount: 0, exportCount: 0 };
    this.titleCountsByUser.set(userId, { ...counts, exportCount: 0 });
    return 0;
  }

  async listSeenTitleKeys(userId: string): Promise<LetterboxdSeenTitleKey[]> {
    return this.seenByUser.get(userId) ?? [];
  }

  async countTitlesBySource(userId: string): Promise<{ rssCount: number; exportCount: number }> {
    return this.titleCountsByUser.get(userId) ?? { rssCount: 0, exportCount: 0 };
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

function createApp(authRepo: InMemoryAuthRepository, profileRepo: InMemoryProfileRepository, letterboxdRepo?: InMemoryLetterboxdRepository | null) {
  const app = express();
  app.use(express.json());
  app.use('/api/profile', createProfileRouter(createConfig(), authRepo, profileRepo, letterboxdRepo ?? null));
  return app;
}

describe('profile router', () => {
  let authRepo: InMemoryAuthRepository;
  let profileRepo: InMemoryProfileRepository;
  let letterboxdRepo: InMemoryLetterboxdRepository;
  let app: express.Express;

  beforeEach(() => {
    authRepo = new InMemoryAuthRepository();
    profileRepo = new InMemoryProfileRepository();
    letterboxdRepo = new InMemoryLetterboxdRepository();
    app = createApp(authRepo, profileRepo, letterboxdRepo);
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

  it('rejects unauthenticated profile mutation', async () => {
    const response = await request(app)
      .patch('/api/profile')
      .set('Origin', 'https://app.example.com')
      .send({ firstName: 'James', lastName: 'Narvey', displayName: 'James', countryCode: 'US', avatarId: 'smiling' });

    expect(response.status).toBe(401);
  });

  it('sets private cache for authenticated profile state but not public reference', async () => {
    const session = createAuthenticatedSession(authRepo, createConfig());

    const profileResponse = await request(app)
      .get('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie);

    const referenceResponse = await request(app)
      .get('/api/profile/reference')
      .set('Origin', 'https://app.example.com');

    expect(profileResponse.headers['cache-control']).toBe('private, no-store');
    expect(referenceResponse.headers['cache-control']).toBeUndefined();
  });

  it('upserts profile and returns normalized payload', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const patchResponse = await request(app)
      .patch('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ firstName: 'James', lastName: 'Narvey', displayName: 'James AI', countryCode: 'us', avatarId: 'heart', letterboxdUsername: 'jamesletter' });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.profile.firstName).toBe('James');
    expect(patchResponse.body.profile.countryCode).toBe('US');

    const getResponse = await request(app).get('/api/profile').set('Origin', 'https://app.example.com').set('Cookie', session.cookie);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.profile.displayName).toBe('James AI');
    expect(getResponse.body.profile.avatarId).toBe('heart');
    expect(getResponse.body.profile.tvtimeUsername).toBeNull();
  });

  it('uses default avatar when profile avatar_id is missing or invalid', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    profileRepo.profiles.set(session.userId, {
      user_id: session.userId,
      first_name: 'Fallback',
      last_name: 'User',
      display_name: 'Fallback User',
      country_code: 'US',
      viewing_format_preference: null,
      personalization_enabled: 1,
      avatar_url: null,
      avatar_id: 'unknown-legacy-avatar',
      letterboxd_username: null,
      letterboxd_profile_url: null,
      tvtime_username: null,
      tvtime_profile_url: null,
    });

    const response = await request(app)
      .get('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie);

    expect(response.status).toBe(200);
    expect(response.body.profile.avatarId).toBe('smiling');
  });

  it('rejects unknown avatar IDs and unsupported profile payload fields', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const invalidAvatarResponse = await request(app)
      .patch('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        firstName: 'James',
        lastName: 'Narvey',
        displayName: 'James AI',
        countryCode: 'US',
        avatarId: 'not-supported',
      });

    expect(invalidAvatarResponse.status).toBe(400);

    const unsupportedFieldResponse = await request(app)
      .patch('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        firstName: 'James',
        lastName: 'Narvey',
        displayName: 'James AI',
        countryCode: 'US',
        avatarId: 'smiling',
        userId: 'malicious-input',
      });

    expect(unsupportedFieldResponse.status).toBe(400);
  });

  it('rejects malformed and oversized avatar payload values', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const invalidValues: unknown[] = [
      ['smiling'],
      { id: 'smiling' },
      88,
      true,
      'x'.repeat(120),
    ];

    for (const value of invalidValues) {
      const response = await request(app)
        .patch('/api/profile')
        .set('Origin', 'https://app.example.com')
        .set('Cookie', session.cookie)
        .set('X-CSRF-Token', session.csrfToken)
        .send({
          firstName: 'James',
          lastName: 'Narvey',
          displayName: 'James AI',
          countryCode: 'US',
          avatarId: value,
        });

      expect(response.status).toBe(400);
    }
  });

  it('supports idempotent duplicate avatar saves and persists across sessions', async () => {
    const config = createConfig();
    const sessionA = createAuthenticatedSession(authRepo, config);

    const payload = {
      firstName: 'James',
      lastName: 'Narvey',
      displayName: 'James AI',
      countryCode: 'US',
      avatarId: 'checkmark',
    };

    const firstSave = await request(app)
      .patch('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', sessionA.cookie)
      .set('X-CSRF-Token', sessionA.csrfToken)
      .send(payload);

    const secondSave = await request(app)
      .patch('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', sessionA.cookie)
      .set('X-CSRF-Token', sessionA.csrfToken)
      .send(payload);

    expect(firstSave.status).toBe(200);
    expect(secondSave.status).toBe(200);
    expect(firstSave.body.profile.avatarId).toBe('checkmark');
    expect(secondSave.body.profile.avatarId).toBe('checkmark');

    authRepo.sessions.clear();
    const sessionB = createAuthenticatedSession(authRepo, config);

    const reload = await request(app)
      .get('/api/profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', sessionB.cookie);

    expect(reload.status).toBe(200);
    expect(reload.body.profile.avatarId).toBe('checkmark');
  });

  it('accepts each valid avatar ID', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    for (const avatar of scoutyAvatarCatalog) {
      const response = await request(app)
        .patch('/api/profile')
        .set('Origin', 'https://app.example.com')
        .set('Cookie', session.cookie)
        .set('X-CSRF-Token', session.csrfToken)
        .send({
          firstName: 'James',
          lastName: 'Narvey',
          displayName: 'James AI',
          countryCode: 'US',
          avatarId: avatar.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.profile.avatarId).toBe(avatar.id);
    }
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
      { providerId: 8, providerName: 'Netflix', sortOrder: 0 },
      { providerId: 9, providerName: 'Prime Video', sortOrder: 1 },
    ]);

    const getResponse = await request(app).get('/api/profile/streaming-services').set('Origin', 'https://app.example.com').set('Cookie', session.cookie);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.catalog.length).toBeGreaterThan(0);
  });

  it('preserves provider order in saved streaming preferences', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const patchResponse = await request(app)
      .patch('/api/profile/streaming-services')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ providerIds: [9, 8] });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.services).toEqual([
      { providerId: 9, providerName: 'Prime Video', sortOrder: 0 },
      { providerId: 8, providerName: 'Netflix', sortOrder: 1 },
    ]);
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
      personalization_enabled: 1,
      avatar_url: null,
      avatar_id: null,
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
        personalizationEnabled: false,
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.marketCode).toBe('GB');
    expect(patchResponse.body.streamingServices).toHaveLength(2);
    expect(patchResponse.body.contentLanguages).toHaveLength(2);
    expect(patchResponse.body.viewingFormatPreference).toBe('subtitles_ok');
    expect(patchResponse.body.personalizationEnabled).toBe(false);
    expect(patchResponse.body.countryProviderCompatibility).toBeDefined();
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

  it('rejects provider arrays above max selection limit', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const response = await request(app)
      .patch('/api/profile/preferences')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        marketCode: 'US',
        providerIds: [8, 9, 337, 2, 1899, 531, 15, 386, 230, 73, 1773],
        languageCodes: [],
        viewingFormatPreference: null,
      });

    expect(response.status).toBe(400);
  });

  it('rejects unsupported fields in preferences payload', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    const response = await request(app)
      .patch('/api/profile/preferences')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        marketCode: 'US',
        providerIds: [8],
        languageCodes: [],
        viewingFormatPreference: null,
        userId: 'malicious-input',
      });

    expect(response.status).toBe(400);
  });

  it('returns reference data without authentication', async () => {
    const response = await request(app).get('/api/profile/reference').set('Origin', 'https://app.example.com');
    expect(response.status).toBe(200);
    expect(response.body.countries.length).toBeGreaterThan(200);
    expect(response.body.languages.length).toBeGreaterThan(0);
    expect(response.body.providers.length).toBeGreaterThan(0);
    expect(response.body.avatars.length).toBe(12);
    expect(response.body.countries[0]).toHaveProperty('code');
    expect(response.body.countries[0]).toHaveProperty('name');
  });

  it('returns country-aware provider catalog metadata', async () => {
    const response = await request(app)
      .get('/api/profile/providers?country=CA')
      .set('Origin', 'https://app.example.com');

    expect(response.status).toBe(200);
    expect(response.body.marketCode).toBe('CA');
    expect(response.body.availabilityKnown).toBe(true);
    expect(response.body.providers.some((provider: { providerName: string }) => provider.providerName === 'Crave')).toBe(true);
  });

  it('preserves incompatible providers by default when changing market', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    profileRepo.profiles.set(session.userId, {
      user_id: session.userId,
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      country_code: 'US',
      viewing_format_preference: null,
      personalization_enabled: 1,
      avatar_url: null,
      avatar_id: null,
      letterboxd_username: null,
      letterboxd_profile_url: null,
      tvtime_username: null,
      tvtime_profile_url: null,
    });

    const response = await request(app)
      .patch('/api/profile/preferences')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ marketCode: 'CA', providerIds: [15, 8], languageCodes: [], viewingFormatPreference: null });

    expect(response.status).toBe(200);
    expect(response.body.streamingServices).toEqual([
      { providerId: 15, providerName: 'Hulu', sortOrder: 0 },
      { providerId: 8, providerName: 'Netflix', sortOrder: 1 },
    ]);
    expect(response.body.countryProviderCompatibility.incompatibleRequestedProviderIds).toContain(15);
    expect(response.body.countryProviderCompatibility.removedProviderIds).toEqual([]);
  });

  it('removes incompatible providers only with explicit confirmation', async () => {
    const config = createConfig();
    const session = createAuthenticatedSession(authRepo, config);

    profileRepo.profiles.set(session.userId, {
      user_id: session.userId,
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      country_code: 'US',
      viewing_format_preference: null,
      personalization_enabled: 1,
      avatar_url: null,
      avatar_id: null,
      letterboxd_username: null,
      letterboxd_profile_url: null,
      tvtime_username: null,
      tvtime_profile_url: null,
    });

    const response = await request(app)
      .patch('/api/profile/preferences')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({
        marketCode: 'CA',
        providerIds: [15, 8],
        languageCodes: [],
        viewingFormatPreference: null,
        allowProviderPrune: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.streamingServices).toEqual([{ providerId: 8, providerName: 'Netflix', sortOrder: 0 }]);
    expect(response.body.countryProviderCompatibility.removedProviderIds).toEqual([15]);
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

  it('returns letterboxd status for authenticated user', async () => {
    const session = createAuthenticatedSession(authRepo, createConfig());

    profileRepo.profiles.set(session.userId, {
      user_id: session.userId,
      first_name: 'Test',
      last_name: 'User',
      display_name: 'Test User',
      country_code: 'US',
      viewing_format_preference: null,
      personalization_enabled: 1,
      avatar_url: null,
      avatar_id: null,
      letterboxd_username: 'jamesletter',
      letterboxd_profile_url: null,
      tvtime_username: null,
      tvtime_profile_url: null,
    });
    await letterboxdRepo.setPublicActivityEnabled(session.userId, true);

    const response = await request(app)
      .get('/api/profile/letterboxd/status')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie);

    expect(response.status).toBe(200);
    expect(response.body.status.enabled).toBe(true);
    expect(response.body.status.username).toBe('jamesletter');
  });

  it('requires csrf for letterboxd settings update', async () => {
    const session = createAuthenticatedSession(authRepo, createConfig());
    const response = await request(app)
      .patch('/api/profile/letterboxd/settings')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .send({ publicActivityEnabled: true });

    expect(response.status).toBe(403);
  });

  it('updates letterboxd settings with csrf', async () => {
    const session = createAuthenticatedSession(authRepo, createConfig());

    const response = await request(app)
      .patch('/api/profile/letterboxd/settings')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken)
      .send({ publicActivityEnabled: true });

    expect(response.status).toBe(200);
    expect(response.body.status.enabled).toBe(true);
  });

  it('fails letterboxd refresh when username is missing', async () => {
    const session = createAuthenticatedSession(authRepo, createConfig());
    await letterboxdRepo.setPublicActivityEnabled(session.userId, true);

    const response = await request(app)
      .post('/api/profile/letterboxd/refresh')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', session.cookie)
      .set('X-CSRF-Token', session.csrfToken);

    expect(response.status).toBe(400);
  });
});
