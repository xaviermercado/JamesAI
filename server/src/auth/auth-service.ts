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
import { logger } from '../utils/logger';

export interface RegisterInput {
  firstName?: string;
  lastName?: string;
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

type TokenInvalidReason = 'not_found' | 'used_or_superseded' | 'expired';

class AuthTokenStateError extends Error {
  constructor(
    message: string,
    public readonly tokenPurpose: 'password_reset' | 'email_verification',
    public readonly tokenReason: TokenInvalidReason,
  ) {
    super(message);
    this.name = 'AuthTokenStateError';
  }
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

function buildDisplayName(firstName: string | undefined, lastName: string | undefined, email: string): string {
  const fullName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName.slice(0, 80);
  }

  return email.split('@')[0].slice(0, 80) || 'JamesAI user';
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
    const firstName = input.firstName?.trim() || null;
    const lastName = input.lastName?.trim() || null;
    const displayName = buildDisplayName(firstName ?? undefined, lastName ?? undefined, normalizedEmail);

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

      await repository.createProfile({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        country_code: 'US',
        avatar_url: null,
        avatar_id: null,
        letterboxd_username: null,
        letterboxd_profile_url: null,
        tvtime_username: null,
        tvtime_profile_url: null,
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
      authenticated_at: createdAt,
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
        authenticatedAt: createdAt.toISOString(),
      },
    };
  }

  async restoreSession(sessionToken: string): Promise<AuthSessionResponse & { identity?: AuthIdentity }> {
    const sessionTokenHash = hashSessionToken(sessionToken, this.sessionPepper);
    const session = await this.repo.findActiveSessionByTokenHash(sessionTokenHash);

    if (!session) {
      return { authenticated: false, user: null, csrfToken: null, authenticatedAt: null };
    }

    await this.repo.touchSessionLastUsedAt(session.session_id, new Date(Date.now() - 5 * 60 * 1000));

    return {
      authenticated: true,
      user: {
        userId: session.user_id,
        email: session.user_email,
        emailVerifiedAt: session.user_email_verified_at ? session.user_email_verified_at.toISOString() : null,
        accountStatus: session.user_account_status,
        adminRole: session.user_admin_role ?? 'user',
        createdAt: session.user_created_at.toISOString(),
        updatedAt: session.user_updated_at.toISOString(),
      },
      csrfToken: createCsrfToken(session.token_hash, this.sessionPepper),
      authenticatedAt: session.authenticated_at?.toISOString() ?? null,
      identity: {
        userId: session.user_id,
        sessionId: session.session_id,
        sessionTokenHash: session.token_hash,
        csrfToken: createCsrfToken(session.token_hash, this.sessionPepper),
        expiresAt: session.expires_at.toISOString(),
        authenticatedAt: session.authenticated_at?.toISOString() ?? null,
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
      const tokenState = await this.findVerificationTokenState(repository, token);
      if (!tokenState.record) {
        throw new AuthTokenStateError('Verification token is invalid or expired', 'email_verification', tokenState.reason);
      }

      const now = new Date();
      await repository.markEmailVerificationTokenUsed(tokenState.record.token_id);
      await repository.updateUserEmailVerification(tokenState.record.user_id, now, 'active');
      await repository.invalidateEmailVerificationTokensForUser(tokenState.record.user_id);
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
      const tokenState = await this.findPasswordResetTokenState(repository, token);
      if (!tokenState.record) {
        throw new AuthTokenStateError('Password reset token is invalid or expired', 'password_reset', tokenState.reason);
      }

      await repository.updateUserPasswordHash(tokenState.record.user_id, passwordHash);
      // Receiving and using the reset token proves email ownership, so activate the account.
      await repository.updateUserEmailVerification(tokenState.record.user_id, new Date(), 'active');
      await repository.markPasswordResetTokenUsed(tokenState.record.token_id);
      await repository.invalidatePasswordResetTokensForUser(tokenState.record.user_id);
      await repository.revokeAllSessionsForUser(tokenState.record.user_id);
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

  private async findVerificationTokenState(repository: AuthRepositoryLike, token: string): Promise<{ record: StoredEmailVerificationToken | null; reason: TokenInvalidReason }> {
    const tokenHash = hashSessionToken(token, this.emailTokenPepper);
    const record = await repository.findEmailVerificationTokenByHash(tokenHash);
    if (!record) {
      return { record: null, reason: 'not_found' };
    }

    if (record.used_at) {
      return { record: null, reason: 'used_or_superseded' };
    }

    if (record.expires_at.getTime() <= Date.now()) {
      return { record: null, reason: 'expired' };
    }

    return { record, reason: 'not_found' };
  }

  private async findPasswordResetTokenState(repository: AuthRepositoryLike, token: string): Promise<{ record: StoredPasswordResetToken | null; reason: TokenInvalidReason }> {
    const tokenHash = hashSessionToken(token, this.emailTokenPepper);
    const record = await repository.findPasswordResetTokenByHash(tokenHash);
    if (!record) {
      return { record: null, reason: 'not_found' };
    }

    if (record.used_at) {
      return { record: null, reason: 'used_or_superseded' };
    }

    if (record.expires_at.getTime() <= Date.now()) {
      return { record: null, reason: 'expired' };
    }

    return { record, reason: 'not_found' };
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
