import { describe, expect, it } from 'vitest';

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
  async updateUserPasswordHash(): Promise<void> {}
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
  async createPasswordResetToken(): Promise<void> {}
  async findPasswordResetTokenByHash(): Promise<StoredPasswordResetToken | null> { return null; }
  async markPasswordResetTokenUsed(): Promise<void> {}
  async invalidatePasswordResetTokensForUser(): Promise<void> {}
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
});