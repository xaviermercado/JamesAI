import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/env';
import { AUTH_SESSION_COOKIE_NAME, createSessionToken, hashSessionToken } from '../auth/auth-crypto';
import type {
  AuthRepositoryLike,
  SessionWithUser,
  StoredEmailVerificationToken,
  StoredPasswordResetToken,
  StoredProfileSeed,
  StoredSession,
  StoredUser,
} from '../auth/auth-repository';
import type { FeedbackRepositoryLike, StoredFeedback, StoredFeedbackType } from '../feedback/feedback-repository';
import type { ContentLanguageSelection, ProfileRepositoryLike, ReplacePreferencesInput, StoredProfile, UpsertProfileInput } from '../profile/profile-repository';
import { createRecommendationsRouter } from './recommendations';
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
    authCookieSameSite: 'none',
    emailProvider: 'console',
    emailTokenPepper: 'y'.repeat(32),
    database: null,
    sessionTokenPepper: 'x'.repeat(32),
  };
}

class StubTmdbService {
  async getRecommendations() {
    return {
      recommendations: [
        {
          tmdbMovieId: 100,
          title: 'Scary Night',
          posterUrl: '',
          releaseYear: 2020,
          runtimeMinutes: 100,
          tmdbRating: 7,
          genres: ['Horror'],
          providers: [],
          country: 'CA',
          mediaType: 'movie' as const,
          originalLanguage: 'en',
          explanation: 'x',
        },
        {
          tmdbMovieId: 200,
          title: 'Funny Evening',
          posterUrl: '',
          releaseYear: 2021,
          runtimeMinutes: 98,
          tmdbRating: 7.2,
          genres: ['Comedy'],
          providers: [],
          country: 'CA',
          mediaType: 'movie' as const,
          originalLanguage: 'fr',
          explanation: 'y',
        },
      ],
      source: 'live' as const,
      preferencesApplied: false,
    };
  }

  async getMovieProviders() {
    return [];
  }
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

class InMemoryProfileRepository implements ProfileRepositoryLike {
  profile: StoredProfile | null = null;

  async findByUserId(_userId: string): Promise<StoredProfile | null> { return this.profile; }
  async upsert(_userId: string, _input: UpsertProfileInput): Promise<StoredProfile> { throw new Error('not used'); }
  async listStreamingServices(_userId: string) { return []; }
  async replaceStreamingServices(_u: string, _c: string, _s: Array<{ providerId: number; providerName: string }>) { return []; }
  async listContentLanguages(_userId: string): Promise<ContentLanguageSelection[]> { return []; }
  async replaceContentLanguages(_u: string, _codes: string[]) { return []; }
  async replacePreferences(_u: string, _input: ReplacePreferencesInput) {}
}

class InMemoryFeedbackRepository implements FeedbackRepositoryLike {
  entries: Array<{ feedbackType: 'liked' | 'disliked'; genresJson: string | null; originalLanguage: string | null }> = [];

  async upsertFeedback(_userId: string, _tmdbId: number, _mediaType: 'movie' | 'tv', _feedbackType: StoredFeedbackType): Promise<StoredFeedback> {
    throw new Error('not used');
  }
  async removeFeedback(_userId: string, _tmdbId: number, _mediaType: 'movie' | 'tv'): Promise<boolean> { return false; }
  async getFeedback(_userId: string, _tmdbId: number, _mediaType: 'movie' | 'tv'): Promise<StoredFeedback | null> { return null; }
  async listFeedback(_userId: string): Promise<StoredFeedback[]> { return []; }
  async listRatedTitleKeys(_userId: string): Promise<Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>> {
    return [{ tmdbId: 100, mediaType: 'movie' }];
  }
  async listFeedbackForSignals(_userId: string) {
    return this.entries;
  }
  async clearAllFeedback(_userId: string): Promise<number> { return 0; }
}

function createAuthenticatedCookie(authRepo: InMemoryAuthRepository, config: AppConfig): string {
  const now = new Date();
  const userId = '11111111-1111-4111-8111-111111111111';
  authRepo.users.set(userId, {
    user_id: userId,
    email: 'user@example.com',
    password_hash: 'ignored',
    email_verified_at: now,
    account_status: 'active',
    created_at: now,
    updated_at: now,
  });

  const token = createSessionToken();
  const hash = hashSessionToken(token, config.sessionTokenPepper ?? '');
  authRepo.sessions.set('sess-1', {
    session_id: 'sess-1',
    user_id: userId,
    token_hash: hash,
    expires_at: new Date(Date.now() + 60 * 60 * 1000),
    revoked_at: null,
    created_at: now,
    last_used_at: null,
    device_label: 'test-device',
    client_platform: 'web',
  });

  return `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

describe('recommendation personalization route integration', () => {
  let authRepo: InMemoryAuthRepository;
  let profileRepo: InMemoryProfileRepository;
  let feedbackRepo: InMemoryFeedbackRepository;
  let app: express.Express;
  const config = createConfig();

  beforeEach(() => {
    authRepo = new InMemoryAuthRepository();
    profileRepo = new InMemoryProfileRepository();
    feedbackRepo = new InMemoryFeedbackRepository();

    app = express();
    app.use(express.json());
    app.use('/api', createRecommendationsRouter(new StubTmdbService() as unknown as TmdbService, config, authRepo, profileRepo, feedbackRepo));

    profileRepo.profile = {
      user_id: '11111111-1111-4111-8111-111111111111',
      first_name: null,
      last_name: null,
      display_name: 'Test',
      country_code: 'CA',
      viewing_format_preference: null,
      personalization_enabled: 1,
      avatar_url: null,
      letterboxd_username: null,
      letterboxd_profile_url: null,
      tvtime_username: null,
      tvtime_profile_url: null,
    };
  });

  it('applies learned ranking signals for authenticated users with enough evidence', async () => {
    feedbackRepo.entries = [
      { feedbackType: 'liked', genresJson: '["Comedy"]', originalLanguage: 'fr' },
      { feedbackType: 'disliked', genresJson: '["Horror"]', originalLanguage: 'en' },
      { feedbackType: 'liked', genresJson: '["Comedy"]', originalLanguage: 'fr' },
    ];

    const cookie = createAuthenticatedCookie(authRepo, config);

    const res = await request(app)
      .post('/api/recommendations')
      .set('Cookie', cookie)
      .send({ description: 'movie night', mediaType: 'movie' });

    expect(res.status).toBe(200);
    expect(res.body.feedbackPersonalizationApplied).toBe(true);
    expect(res.body.recommendations[0].tmdbMovieId).toBe(200);
  });

  it('does not apply learned signals when personalization is disabled', async () => {
    profileRepo.profile = {
      ...(profileRepo.profile as StoredProfile),
      personalization_enabled: 0,
    };
    feedbackRepo.entries = [
      { feedbackType: 'liked', genresJson: '["Comedy"]', originalLanguage: 'fr' },
      { feedbackType: 'disliked', genresJson: '["Horror"]', originalLanguage: 'en' },
      { feedbackType: 'liked', genresJson: '["Comedy"]', originalLanguage: 'fr' },
    ];

    const cookie = createAuthenticatedCookie(authRepo, config);

    const res = await request(app)
      .post('/api/recommendations')
      .set('Cookie', cookie)
      .send({ description: 'movie night', mediaType: 'movie' });

    expect(res.status).toBe(200);
    expect(res.body.feedbackPersonalizationApplied).toBe(false);
    expect(res.body.recommendations[0].tmdbMovieId).toBe(100);
  });
});
