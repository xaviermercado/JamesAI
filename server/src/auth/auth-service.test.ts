import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import type { AppConfig } from '../config/env';
import type {
  AuthRepositoryLike,
  SessionWithUser,
  StoredEmailVerificationToken,
  StoredPasswordResetToken,
  StoredProfileSeed,
  StoredSession,
  StoredUser,
} from './auth-repository';
import { AuthService } from './auth-service';
import { hashSessionToken } from './auth-crypto';

class TransactionalRepo implements AuthRepositoryLike {
  users = new Map<string, StoredUser>();
  profiles = new Map<string, StoredProfileSeed>();
  sessions = new Map<string, StoredSession>();
  emailTokens = new Map<string, StoredEmailVerificationToken>();
  passwordTokens = new Map<string, StoredPasswordResetToken>();
  failProfileInsert = false;

  async withTransaction<T>(operation: (repository: AuthRepositoryLike) => Promise<T>): Promise<T> {
    const usersSnapshot = new Map(this.users);
    const profilesSnapshot = new Map(this.profiles);
    const emailTokensSnapshot = new Map(this.emailTokens);

    try {
      return await operation(this);
    } catch (error) {
      this.users = usersSnapshot;
      this.profiles = profilesSnapshot;
      this.emailTokens = emailTokensSnapshot;
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findUserById(userId: string): Promise<StoredUser | null> {
    return this.users.get(userId) ?? null;
  }

  async createUser(user: Pick<StoredUser, 'user_id' | 'email' | 'password_hash' | 'account_status' | 'email_verified_at' | 'created_at' | 'updated_at'>): Promise<void> {
    this.users.set(user.user_id, user as StoredUser);
  }

  async createProfile(profile: StoredProfileSeed): Promise<void> {
    if (this.failProfileInsert) {
      throw new Error('profile insert failed');
    }

    this.profiles.set(profile.user_id, profile);
  }

  async updateUserEmailVerification(): Promise<void> {}
  async updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.password_hash = passwordHash;
    }
  }
  async createSession(): Promise<void> {}
  async findActiveSessionByTokenHash(): Promise<SessionWithUser | null> { return null; }
  async touchSessionLastUsedAt(): Promise<void> {}
  async revokeSession(): Promise<void> {}
  async revokeAllSessionsForUser(): Promise<number> { return 0; }
  async createEmailVerificationToken(token: Omit<StoredEmailVerificationToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void> {
    this.emailTokens.set(token.token_id, { ...token, used_at: token.used_at ?? null, created_at: token.created_at ?? new Date() });
  }
  async findEmailVerificationTokenByHash(): Promise<StoredEmailVerificationToken | null> { return null; }
  async markEmailVerificationTokenUsed(): Promise<void> {}
  async invalidateEmailVerificationTokensForUser(): Promise<void> {}
  async createPasswordResetToken(token: Omit<StoredPasswordResetToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void> {
    this.passwordTokens.set(token.token_id, { ...token, used_at: token.used_at ?? null, created_at: token.created_at ?? new Date() });
  }
  async findPasswordResetTokenByHash(tokenHash: string): Promise<StoredPasswordResetToken | null> {
    return [...this.passwordTokens.values()].find((token) => token.token_hash === tokenHash) ?? null;
  }
  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    const token = this.passwordTokens.get(tokenId);
    if (token) {
      token.used_at = new Date();
    }
  }
  async invalidatePasswordResetTokensForUser(userId: string): Promise<void> {
    for (const token of this.passwordTokens.values()) {
      if (token.user_id === userId && token.used_at === null) {
        token.used_at = new Date();
      }
    }
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

describe('AuthService register transaction', () => {
  it('rolls back the user when profile creation fails', async () => {
    const repo = new TransactionalRepo();
    repo.failProfileInsert = true;
    const service = new AuthService(repo, createConfig(), {
      sendVerificationEmail: async () => undefined,
      sendPasswordResetEmail: async () => undefined,
    });

    await expect(service.register({
      firstName: 'Ana María',
      lastName: 'Díaz',
      email: 'ana@example.com',
      password: 'password-password',
    })).rejects.toThrow('profile insert failed');

    expect(repo.users.size).toBe(0);
    expect(repo.profiles.size).toBe(0);
    expect(repo.emailTokens.size).toBe(0);
  });

  it('classifies missing password reset tokens as not_found', async () => {
    const repo = new TransactionalRepo();
    const service = new AuthService(repo, createConfig(), {
      sendVerificationEmail: async () => undefined,
      sendPasswordResetEmail: async () => undefined,
    });

    await expect(service.resetPassword('missing-token', 'password-password')).rejects.toMatchObject({
      name: 'AuthTokenStateError',
      tokenPurpose: 'password_reset',
      tokenReason: 'not_found',
    });
  });

  it('classifies expired password reset tokens as expired', async () => {
    const repo = new TransactionalRepo();
    const config = createConfig();
    const service = new AuthService(repo, config, {
      sendVerificationEmail: async () => undefined,
      sendPasswordResetEmail: async () => undefined,
    });
    const userId = randomUUID();
    const rawToken = 'expired-reset-token';

    repo.users.set(userId, {
      user_id: userId,
      email: 'user@example.com',
      password_hash: 'hash',
      email_verified_at: new Date(),
      account_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    repo.passwordTokens.set(randomUUID(), {
      token_id: randomUUID(),
      user_id: userId,
      token_hash: hashSessionToken(rawToken, config.emailTokenPepper ?? ''),
      expires_at: new Date(Date.now() - 1_000),
      used_at: null,
      created_at: new Date(),
    });

    await expect(service.resetPassword(rawToken, 'password-password')).rejects.toMatchObject({
      name: 'AuthTokenStateError',
      tokenPurpose: 'password_reset',
      tokenReason: 'expired',
    });
  });

  it('classifies superseded password reset tokens as used_or_superseded', async () => {
    const repo = new TransactionalRepo();
    const config = createConfig();
    const service = new AuthService(repo, config, {
      sendVerificationEmail: async () => undefined,
      sendPasswordResetEmail: async () => undefined,
    });
    const userId = randomUUID();
    const rawToken = 'used-reset-token';

    repo.users.set(userId, {
      user_id: userId,
      email: 'user@example.com',
      password_hash: 'hash',
      email_verified_at: new Date(),
      account_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    repo.passwordTokens.set(randomUUID(), {
      token_id: randomUUID(),
      user_id: userId,
      token_hash: hashSessionToken(rawToken, config.emailTokenPepper ?? ''),
      expires_at: new Date(Date.now() + 60_000),
      used_at: new Date(),
      created_at: new Date(),
    });

    await expect(service.resetPassword(rawToken, 'password-password')).rejects.toMatchObject({
      name: 'AuthTokenStateError',
      tokenPurpose: 'password_reset',
      tokenReason: 'used_or_superseded',
    });
  });
});