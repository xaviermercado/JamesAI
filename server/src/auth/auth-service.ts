import { randomUUID } from 'node:crypto';

import argon2 from 'argon2';

import type { AppConfig } from '../config/env';
import { createEmailService, type EmailService } from '../email/email-service';
import { createCsrfToken, createSessionToken, hashSessionToken, normalizeEmail } from './auth-crypto';
import { getSessionTtlMs } from './auth-cookie';
import type {
  AuthRepositoryLike,
  StoredEmailVerificationToken,
  StoredPasswordResetToken,
  StoredUser,
} from './auth-repository';
import { toSafeUser } from './auth-repository';
import type { AuthIdentity, AuthSessionResponse, SafeUser } from './auth-types';

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput extends RegisterInput {
  deviceLabel?: string | null;
  clientPlatform?: 'web' | 'ios' | 'android' | 'unknown';
}

export interface AuthServiceResult {
  user: SafeUser;
  sessionToken?: string;
  identity?: AuthIdentity;
}

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function tokenExpiresAt(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}

function buildLink(baseUrl: string | undefined, path: string, token: string): string {
  if (!baseUrl) {
    throw new Error('APP_BASE_URL is required for email links');
  }

  const url = new URL(path, baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

function isVerified(user: StoredUser): boolean {
  return user.account_status === 'active' && user.email_verified_at !== null;
}

export class AuthService {
  constructor(
    private readonly repo: AuthRepositoryLike,
    private readonly config: AppConfig,
    private readonly emailService: EmailService = createEmailService(config),
  ) {}

  async register(input: RegisterInput): Promise<AuthServiceResult> {
    const normalizedEmail = normalizeEmail(input.email);
    const now = new Date();
    const userId = randomUUID();
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    const verificationUrl = await this.repo.withTransaction(async (repository) => {
      const existingUser = await repository.findUserByEmail(normalizedEmail);
      if (existingUser) {
        throw new Error('duplicate email');
      }

      await repository.createUser({
        user_id: userId,
        email: normalizedEmail,
        password_hash: passwordHash,
        account_status: 'pending_verification',
        email_verified_at: null,
        created_at: now,
        updated_at: now,
      });

      const token = this.createToken(VERIFICATION_TOKEN_TTL_MS);
      await repository.createEmailVerificationToken({
        token_id: randomUUID(),
        user_id: userId,
        token_hash: token.tokenHash,
        expires_at: token.expiresAt,
      });

      return buildLink(this.config.appBaseUrl, '/verify-email', token.rawToken);
    });

    await this.emailService.sendVerificationEmail({
      to: normalizedEmail,
      verificationUrl,
    });

    const user = await this.mustGetUser(userId);
    return { user: toSafeUser(user) };
  }

  async login(input: LoginInput): Promise<AuthServiceResult> {
    const normalizedEmail = normalizeEmail(input.email);
    const user = await this.repo.findUserByEmail(normalizedEmail);

    if (!user || !isVerified(user)) {
      throw new Error('Invalid email or password');
    }

    const passwordMatches = await argon2.verify(user.password_hash, input.password);
    if (!passwordMatches) {
      throw new Error('Invalid email or password');
    }

    const sessionToken = createSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken, this.sessionPepper);
    const sessionId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + getSessionTtlMs());

    await this.repo.createSession({
      session_id: sessionId,
      user_id: user.user_id,
      token_hash: sessionTokenHash,
      expires_at: expiresAt,
      created_at: createdAt,
      last_used_at: null,
      device_label: input.deviceLabel ?? null,
      client_platform: input.clientPlatform ?? 'web',
    });

    return {
      user: toSafeUser(user),
      sessionToken,
      identity: {
        userId: user.user_id,
        sessionId,
        sessionTokenHash,
        csrfToken: createCsrfToken(sessionTokenHash, this.sessionPepper),
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async restoreSession(sessionToken: string): Promise<AuthSessionResponse & { identity?: AuthIdentity }> {
    const sessionTokenHash = hashSessionToken(sessionToken, this.sessionPepper);
    const session = await this.repo.findActiveSessionByTokenHash(sessionTokenHash);

    if (!session) {
      return { authenticated: false, user: null, csrfToken: null };
    }

    await this.repo.touchSessionLastUsedAt(session.session_id, new Date(Date.now() - 5 * 60 * 1000));

    return {
      authenticated: true,
      user: {
        userId: session.user_id,
        email: session.user_email,
        emailVerifiedAt: session.user_email_verified_at ? session.user_email_verified_at.toISOString() : null,
        accountStatus: session.user_account_status,
        createdAt: session.user_created_at.toISOString(),
        updatedAt: session.user_updated_at.toISOString(),
      },
      csrfToken: createCsrfToken(session.token_hash, this.sessionPepper),
      identity: {
        userId: session.user_id,
        sessionId: session.session_id,
        sessionTokenHash: session.token_hash,
        csrfToken: createCsrfToken(session.token_hash, this.sessionPepper),
        expiresAt: session.expires_at.toISOString(),
      },
    };
  }

  async logout(sessionToken: string): Promise<void> {
    const sessionTokenHash = hashSessionToken(sessionToken, this.sessionPepper);
    const session = await this.repo.findActiveSessionByTokenHash(sessionTokenHash);
    if (!session) {
      return;
    }

    await this.repo.revokeSession(session.session_id);
  }

  async logoutAll(userId: string): Promise<number> {
    return this.repo.revokeAllSessionsForUser(userId);
  }

  async verifyEmail(token: string): Promise<void> {
    await this.repo.withTransaction(async (repository) => {
      const tokenRecord = await this.findValidVerificationToken(repository, token);
      if (!tokenRecord) {
        throw new Error('Verification token is invalid or expired');
      }

      const now = new Date();
      await repository.markEmailVerificationTokenUsed(tokenRecord.token_id);
      await repository.updateUserEmailVerification(tokenRecord.user_id, now, 'active');
      await repository.invalidateEmailVerificationTokensForUser(tokenRecord.user_id);
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.repo.findUserByEmail(normalizeEmail(email));
    if (!user || isVerified(user)) {
      return;
    }

    const verificationUrl = await this.createVerificationUrl(user.user_id);
    await this.emailService.sendVerificationEmail({
      to: user.email,
      verificationUrl,
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.repo.findUserByEmail(normalizeEmail(email));
    if (!user || user.account_status === 'disabled') {
      return;
    }

    const resetUrl = await this.createPasswordResetUrl(user.user_id);
    await this.emailService.sendPasswordResetEmail({
      to: user.email,
      resetUrl,
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await this.repo.withTransaction(async (repository) => {
      const tokenRecord = await this.findValidPasswordResetToken(repository, token);
      if (!tokenRecord) {
        throw new Error('Password reset token is invalid or expired');
      }

      await repository.updateUserPasswordHash(tokenRecord.user_id, passwordHash);
      await repository.markPasswordResetTokenUsed(tokenRecord.token_id);
      await repository.invalidatePasswordResetTokensForUser(tokenRecord.user_id);
      await repository.revokeAllSessionsForUser(tokenRecord.user_id);
    });
  }

  private async createVerificationUrl(userId: string): Promise<string> {
    return this.repo.withTransaction(async (repository) => {
      const token = this.createToken(VERIFICATION_TOKEN_TTL_MS);
      await repository.invalidateEmailVerificationTokensForUser(userId);
      await repository.createEmailVerificationToken({
        token_id: randomUUID(),
        user_id: userId,
        token_hash: token.tokenHash,
        expires_at: token.expiresAt,
      });

      return buildLink(this.config.appBaseUrl, '/verify-email', token.rawToken);
    });
  }

  private async createPasswordResetUrl(userId: string): Promise<string> {
    return this.repo.withTransaction(async (repository) => {
      const token = this.createToken(PASSWORD_RESET_TOKEN_TTL_MS);
      await repository.invalidatePasswordResetTokensForUser(userId);
      await repository.createPasswordResetToken({
        token_id: randomUUID(),
        user_id: userId,
        token_hash: token.tokenHash,
        expires_at: token.expiresAt,
      });

      return buildLink(this.config.appBaseUrl, '/reset-password', token.rawToken);
    });
  }

  private async findValidVerificationToken(repository: AuthRepositoryLike, token: string): Promise<StoredEmailVerificationToken | null> {
    const tokenHash = hashSessionToken(token, this.emailTokenPepper);
    const record = await repository.findEmailVerificationTokenByHash(tokenHash);
    if (!record || record.used_at || record.expires_at.getTime() <= Date.now()) {
      return null;
    }

    return record;
  }

  private async findValidPasswordResetToken(repository: AuthRepositoryLike, token: string): Promise<StoredPasswordResetToken | null> {
    const tokenHash = hashSessionToken(token, this.emailTokenPepper);
    const record = await repository.findPasswordResetTokenByHash(tokenHash);
    if (!record || record.used_at || record.expires_at.getTime() <= Date.now()) {
      return null;
    }

    return record;
  }

  private async mustGetUser(userId: string): Promise<StoredUser> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  private createToken(ttlMs: number): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const rawToken = createSessionToken();
    return {
      rawToken,
      tokenHash: hashSessionToken(rawToken, this.emailTokenPepper),
      expiresAt: tokenExpiresAt(ttlMs),
    };
  }

  private get sessionPepper(): string {
    if (!this.config.sessionTokenPepper) {
      throw new Error('SESSION_TOKEN_PEPPER is required when authentication is enabled');
    }

    return this.config.sessionTokenPepper;
  }

  private get emailTokenPepper(): string {
    if (!this.config.emailTokenPepper) {
      throw new Error('EMAIL_TOKEN_PEPPER is required when authentication is enabled');
    }

    return this.config.emailTokenPepper;
  }
}
