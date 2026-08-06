import type { Pool } from 'mysql2';

import type { AuthAccountStatus, SafeUser } from './auth-types';

export interface StoredUser {
  user_id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  account_status: AuthAccountStatus;
  created_at: Date;
  updated_at: Date;
}

export interface StoredSession {
  session_id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  last_used_at: Date | null;
  device_label: string | null;
  client_platform: 'web' | 'ios' | 'android' | 'unknown';
}

export interface StoredProfileSeed {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  country_code: string;
  avatar_url: string | null;
  letterboxd_username: string | null;
  letterboxd_profile_url: string | null;
  tvtime_username: string | null;
  tvtime_profile_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StoredEmailVerificationToken {
  token_id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export interface StoredPasswordResetToken {
  token_id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export interface SessionWithUser extends StoredSession {
  user_email: string;
  user_email_verified_at: Date | null;
  user_account_status: AuthAccountStatus;
  user_created_at: Date;
  user_updated_at: Date;
}

export interface AuthRepositoryLike {
  withTransaction<T>(operation: (repository: AuthRepositoryLike) => Promise<T>): Promise<T>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(userId: string): Promise<StoredUser | null>;
  createUser(user: Pick<StoredUser, 'user_id' | 'email' | 'password_hash' | 'account_status' | 'email_verified_at' | 'created_at' | 'updated_at'>): Promise<void>;
  createProfile(profile: StoredProfileSeed): Promise<void>;
  updateUserEmailVerification(userId: string, emailVerifiedAt: Date, accountStatus: AuthAccountStatus): Promise<void>;
  updateUserPasswordHash(userId: string, passwordHash: string): Promise<void>;
  createSession(session: Omit<StoredSession, 'revoked_at'>): Promise<void>;
  findActiveSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | null>;
  touchSessionLastUsedAt(sessionId: string, threshold: Date): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllSessionsForUser(userId: string): Promise<number>;
  createEmailVerificationToken(token: Omit<StoredEmailVerificationToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void>;
  findEmailVerificationTokenByHash(tokenHash: string): Promise<StoredEmailVerificationToken | null>;
  markEmailVerificationTokenUsed(tokenId: string): Promise<void>;
  invalidateEmailVerificationTokensForUser(userId: string): Promise<void>;
  createPasswordResetToken(token: Omit<StoredPasswordResetToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void>;
  findPasswordResetTokenByHash(tokenHash: string): Promise<StoredPasswordResetToken | null>;
  markPasswordResetTokenUsed(tokenId: string): Promise<void>;
  invalidatePasswordResetTokensForUser(userId: string): Promise<void>;
}

type PromisePool = ReturnType<Pool['promise']>;
type PromisePoolConnection = Awaited<ReturnType<PromisePool['getConnection']>>;
type SqlExecutor = Pick<PromisePool, 'query'>;

abstract class BaseAuthRepository implements AuthRepositoryLike {
  constructor(protected readonly executor: SqlExecutor) {}

  async withTransaction<T>(operation: (repository: AuthRepositoryLike) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.selectOne<StoredUser>(
      'SELECT user_id, email, password_hash, email_verified_at, account_status, created_at, updated_at FROM users WHERE email = ? LIMIT 1',
      [email],
    );
  }

  async findUserById(userId: string): Promise<StoredUser | null> {
    return this.selectOne<StoredUser>(
      'SELECT user_id, email, password_hash, email_verified_at, account_status, created_at, updated_at FROM users WHERE user_id = ? LIMIT 1',
      [userId],
    );
  }

  async createUser(user: Pick<StoredUser, 'user_id' | 'email' | 'password_hash' | 'account_status' | 'email_verified_at' | 'created_at' | 'updated_at'>): Promise<void> {
    await this.executor.query(
      'INSERT INTO users (user_id, email, password_hash, email_verified_at, account_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user.user_id, user.email, user.password_hash, user.email_verified_at, user.account_status, user.created_at, user.updated_at],
    );
  }

  async createProfile(profile: StoredProfileSeed): Promise<void> {
    await this.executor.query(
      'INSERT INTO profiles (user_id, first_name, last_name, display_name, country_code, avatar_url, letterboxd_username, letterboxd_profile_url, tvtime_username, tvtime_profile_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        profile.user_id,
        profile.first_name,
        profile.last_name,
        profile.display_name,
        profile.country_code,
        profile.avatar_url,
        profile.letterboxd_username,
        profile.letterboxd_profile_url,
        profile.tvtime_username,
        profile.tvtime_profile_url,
        profile.created_at,
        profile.updated_at,
      ],
    );
  }

  async updateUserEmailVerification(userId: string, emailVerifiedAt: Date, accountStatus: AuthAccountStatus): Promise<void> {
    await this.executor.query(
      'UPDATE users SET email_verified_at = ?, account_status = ?, updated_at = NOW(3) WHERE user_id = ?',
      [emailVerifiedAt, accountStatus, userId],
    );
  }

  async updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.executor.query(
      'UPDATE users SET password_hash = ?, updated_at = NOW(3) WHERE user_id = ?',
      [passwordHash, userId],
    );
  }

  async createSession(session: Omit<StoredSession, 'revoked_at'>): Promise<void> {
    await this.executor.query(
      'INSERT INTO user_sessions (session_id, user_id, token_hash, expires_at, revoked_at, created_at, last_used_at, device_label, client_platform) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)',
      [session.session_id, session.user_id, session.token_hash, session.expires_at, session.created_at, session.last_used_at, session.device_label, session.client_platform],
    );
  }

  async findActiveSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | null> {
    // Diagnostic: log hash prefix to verify pepper consistency. Remove after confirming fix.
    console.log('[session-lookup] hash prefix:', tokenHash.slice(0, 12));
    const result = await this.selectOne<SessionWithUser>(
      'SELECT s.session_id, s.user_id, s.token_hash, s.expires_at, s.revoked_at, s.created_at, s.last_used_at, s.device_label, s.client_platform, u.email AS user_email, u.email_verified_at AS user_email_verified_at, u.account_status AS user_account_status, u.created_at AS user_created_at, u.updated_at AS user_updated_at FROM user_sessions s INNER JOIN users u ON u.user_id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > NOW(3) LIMIT 1',
      [tokenHash],
    );
    console.log('[session-lookup] found:', Boolean(result));
    return result;
  }

  async touchSessionLastUsedAt(sessionId: string, threshold: Date): Promise<void> {
    await this.executor.query(
      'UPDATE user_sessions SET last_used_at = NOW(3) WHERE session_id = ? AND (last_used_at IS NULL OR last_used_at < ?)',
      [sessionId, threshold],
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.executor.query('UPDATE user_sessions SET revoked_at = NOW(3) WHERE session_id = ? AND revoked_at IS NULL', [sessionId]);
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    const [result] = await this.executor.query('UPDATE user_sessions SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    return (result as { affectedRows?: number }).affectedRows ?? 0;
  }

  async createEmailVerificationToken(token: Omit<StoredEmailVerificationToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void> {
    await this.executor.query(
      'INSERT INTO email_verification_tokens (token_id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [token.token_id, token.user_id, token.token_hash, token.expires_at, token.used_at ?? null, token.created_at ?? new Date()],
    );
  }

  async findEmailVerificationTokenByHash(tokenHash: string): Promise<StoredEmailVerificationToken | null> {
    return this.selectOne<StoredEmailVerificationToken>(
      'SELECT token_id, user_id, token_hash, expires_at, used_at, created_at FROM email_verification_tokens WHERE token_hash = ? LIMIT 1',
      [tokenHash],
    );
  }

  async markEmailVerificationTokenUsed(tokenId: string): Promise<void> {
    await this.executor.query('UPDATE email_verification_tokens SET used_at = NOW(3) WHERE token_id = ? AND used_at IS NULL', [tokenId]);
  }

  async invalidateEmailVerificationTokensForUser(userId: string): Promise<void> {
    await this.executor.query('UPDATE email_verification_tokens SET used_at = NOW(3) WHERE user_id = ? AND used_at IS NULL', [userId]);
  }

  async createPasswordResetToken(token: Omit<StoredPasswordResetToken, 'used_at' | 'created_at'> & { used_at?: Date | null; created_at?: Date }): Promise<void> {
    await this.executor.query(
      'INSERT INTO password_reset_tokens (token_id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [token.token_id, token.user_id, token.token_hash, token.expires_at, token.used_at ?? null, token.created_at ?? new Date()],
    );
  }

  async findPasswordResetTokenByHash(tokenHash: string): Promise<StoredPasswordResetToken | null> {
    return this.selectOne<StoredPasswordResetToken>(
      'SELECT token_id, user_id, token_hash, expires_at, used_at, created_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1',
      [tokenHash],
    );
  }

  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    await this.executor.query('UPDATE password_reset_tokens SET used_at = NOW(3) WHERE token_id = ? AND used_at IS NULL', [tokenId]);
  }

  async invalidatePasswordResetTokensForUser(userId: string): Promise<void> {
    await this.executor.query('UPDATE password_reset_tokens SET used_at = NOW(3) WHERE user_id = ? AND used_at IS NULL', [userId]);
  }

  protected async selectOne<T>(sql: string, params: readonly unknown[]): Promise<T | null> {
    const [rows] = await this.executor.query(sql, [...params]);
    return ((rows as T[])[0] ?? null) as T | null;
  }
}

class TransactionAuthRepository extends BaseAuthRepository {
  async withTransaction<T>(operation: (repository: AuthRepositoryLike) => Promise<T>): Promise<T> {
    return operation(this);
  }
}

export class AuthRepository extends BaseAuthRepository {
  constructor(private readonly pool: PromisePool) {
    super(pool);
  }

  async withTransaction<T>(operation: (repository: AuthRepositoryLike) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const repository = new TransactionAuthRepository(connection);
      const result = await operation(repository);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export function toSafeUser(user: StoredUser): SafeUser {
  return {
    userId: user.user_id,
    email: user.email,
    emailVerifiedAt: user.email_verified_at ? user.email_verified_at.toISOString() : null,
    accountStatus: user.account_status,
    createdAt: user.created_at.toISOString(),
    updatedAt: user.updated_at.toISOString(),
  };
}
