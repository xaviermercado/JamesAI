import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/env';
import type { EmailService } from '../email/email-service';
import { createAuthRouter } from '../auth/auth-router';
import type {
  AuthRepositoryLike,
  SessionWithUser,
  StoredEmailVerificationToken,
  StoredPasswordResetToken,
  StoredProfileSeed,
  StoredSession,
  StoredUser,
} from '../auth/auth-repository';
import { createLibraryRouter } from './library-router';
import type { LibraryRepositoryLike, ListLibraryInput, StoredLibraryTitle } from './library-repository';
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
  profiles = new Map<string, StoredProfileSeed>();
  sessions = new Map<string, StoredSession>();
  emailVerificationTokens = new Map<string, StoredEmailVerificationToken>();
  passwordResetTokens = new Map<string, StoredPasswordResetToken>();

  async withTransaction<T>(operation: (repository: AuthRepositoryLike) => Promise<T>): Promise<T> { return operation(this); }
  async findUserByEmail(email: string): Promise<StoredUser | null> { return [...this.users.values()].find((u) => u.email === email) ?? null; }
  async findUserById(userId: string): Promise<StoredUser | null> { return this.users.get(userId) ?? null; }
  async createUser(user: StoredUser): Promise<void> { this.users.set(user.user_id, user); }
  async createProfile(profile: StoredProfileSeed): Promise<void> { this.profiles.set(profile.user_id, profile); }
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
  async createSession(session: Omit<StoredSession, 'revoked_at'>): Promise<void> { this.sessions.set(session.session_id, { ...session, revoked_at: null }); }
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
        count++;
      }
    }
    return count;
  }
  async createEmailVerificationToken(token: Omit<StoredEmailVerificationToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void> {
    this.emailVerificationTokens.set(token.token_id, {
      ...token,
      used_at: token.used_at ?? null,
      created_at: token.created_at ?? new Date(),
    });
  }
  async findEmailVerificationTokenByHash(tokenHash: string): Promise<StoredEmailVerificationToken | null> {
    return [...this.emailVerificationTokens.values()].find((token) => token.token_hash === tokenHash) ?? null;
  }
  async markEmailVerificationTokenUsed(tokenId: string): Promise<void> {
    const token = this.emailVerificationTokens.get(tokenId);
    if (token) token.used_at = new Date();
  }
  async invalidateEmailVerificationTokensForUser(userId: string): Promise<void> {
    for (const token of this.emailVerificationTokens.values()) {
      if (token.user_id === userId && token.used_at === null) token.used_at = new Date();
    }
  }
  async createPasswordResetToken(token: Omit<StoredPasswordResetToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void> {
    this.passwordResetTokens.set(token.token_id, {
      ...token,
      used_at: token.used_at ?? null,
      created_at: token.created_at ?? new Date(),
    });
  }
  async findPasswordResetTokenByHash(tokenHash: string): Promise<StoredPasswordResetToken | null> {
    return [...this.passwordResetTokens.values()].find((token) => token.token_hash === tokenHash) ?? null;
  }
  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    const token = this.passwordResetTokens.get(tokenId);
    if (token) token.used_at = new Date();
  }
  async invalidatePasswordResetTokensForUser(userId: string): Promise<void> {
    for (const token of this.passwordResetTokens.values()) {
      if (token.user_id === userId && token.used_at === null) token.used_at = new Date();
    }
  }
}

class FakeEmailService implements EmailService {
  verificationUrls: Array<{ to: string; verificationUrl: string }> = [];
  resetUrls: Array<{ to: string; resetUrl: string }> = [];

  async sendVerificationEmail(payload: { to: string; verificationUrl: string }): Promise<void> {
    this.verificationUrls.push(payload);
  }

  async sendPasswordResetEmail(payload: { to: string; resetUrl: string }): Promise<void> {
    this.resetUrls.push(payload);
  }
}

class InMemoryLibraryRepository implements LibraryRepositoryLike {
  async upsertWatchlist(_userId: string, _tmdbId: number, _mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle> { throw new Error('not used'); }
  async markWatched(_userId: string, _tmdbId: number, _mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle> { throw new Error('not used'); }
  async markUnwatched(_userId: string, _tmdbId: number, _mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle> { throw new Error('not used'); }
  async removeTitle(_userId: string, _tmdbId: number, _mediaType: 'movie' | 'tv'): Promise<boolean> { return false; }
  async getTitle(_userId: string, _tmdbId: number, _mediaType: 'movie' | 'tv'): Promise<StoredLibraryTitle | null> { return null; }
  async listLibrary(_userId: string, _input: ListLibraryInput): Promise<{ rows: StoredLibraryTitle[]; total: number }> {
    return { rows: [], total: 0 };
  }
  async listStates(_userId: string, _titles: Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>): Promise<StoredLibraryTitle[]> { return []; }
  async listWatchedTitleIds(_userId: string, _mediaType: 'movie' | 'tv', _limit = 300): Promise<number[]> { return []; }
  async clearWatchlist(_userId: string): Promise<number> { return 0; }
  async clearWatched(_userId: string): Promise<number> { return 0; }
}

class StubTmdbService {
  async getTitleSummaries() { return []; }
}

function readTokenFromUrl(urlString: string): string {
  return new URL(urlString).searchParams.get('token') ?? '';
}

describe('session cookie and authenticated library regression', () => {
  it('keeps SameSite=Lax and allows login then authenticated library request', async () => {
    const config = createConfig();
    const authRepo = new InMemoryAuthRepository();
    const emailService = new FakeEmailService();
    const libraryRepo = new InMemoryLibraryRepository();

    const app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(config, authRepo, emailService));
    app.use('/api/library', createLibraryRouter(config, authRepo, libraryRepo, new StubTmdbService() as unknown as TmdbService));

    const registerRes = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    expect(registerRes.status).toBe(201);

    const verificationToken = readTokenFromUrl(emailService.verificationUrls[0].verificationUrl);
    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .set('Origin', 'https://app.example.com')
      .send({ token: verificationToken });

    expect(verifyRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain('SameSite=Lax');

    const cookieHeader = setCookie.split(';')[0];
    const libraryRes = await request(app)
      .get('/api/library/watchlist')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookieHeader);

    expect(libraryRes.status).toBe(200);
  });
});
