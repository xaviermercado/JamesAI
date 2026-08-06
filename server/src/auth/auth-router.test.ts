import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/env';
import type { EmailService } from '../email/email-service';
import { createAuthRouter } from './auth-router';
import type {
  AuthRepositoryLike,
  StoredProfileSeed,
  SessionWithUser,
  StoredEmailVerificationToken,
  StoredPasswordResetToken,
  StoredSession,
  StoredUser,
} from './auth-repository';

class InMemoryAuthRepository implements AuthRepositoryLike {
  users = new Map<string, StoredUser>();

  profiles = new Map<string, StoredProfileSeed>();

  sessions = new Map<string, StoredSession>();

  emailVerificationTokens = new Map<string, StoredEmailVerificationToken>();

  passwordResetTokens = new Map<string, StoredPasswordResetToken>();

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
    if ([...this.users.values()].some((currentUser) => currentUser.email === user.email)) {
      throw Object.assign(new Error('duplicate email'), { code: 'ER_DUP_ENTRY' });
    }

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

    if (!session) {
      return null;
    }

    const user = this.users.get(session.user_id);
    if (!user) {
      return null;
    }

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
    if (session) {
      session.revoked_at = new Date();
    }
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

  async createEmailVerificationToken(token: StoredEmailVerificationToken): Promise<void> {
    this.emailVerificationTokens.set(token.token_id, { ...token, used_at: token.used_at ?? null, created_at: token.created_at ?? new Date() });
  }

  async findEmailVerificationTokenByHash(tokenHash: string): Promise<StoredEmailVerificationToken | null> {
    return [...this.emailVerificationTokens.values()].find((token) => token.token_hash === tokenHash) ?? null;
  }

  async markEmailVerificationTokenUsed(tokenId: string): Promise<void> {
    const token = this.emailVerificationTokens.get(tokenId);
    if (token) {
      token.used_at = new Date();
    }
  }

  async invalidateEmailVerificationTokensForUser(userId: string): Promise<void> {
    for (const token of this.emailVerificationTokens.values()) {
      if (token.user_id === userId && token.used_at === null) {
        token.used_at = new Date();
      }
    }
  }

  async createPasswordResetToken(token: StoredPasswordResetToken): Promise<void> {
    this.passwordResetTokens.set(token.token_id, { ...token, used_at: token.used_at ?? null, created_at: token.created_at ?? new Date() });
  }

  async findPasswordResetTokenByHash(tokenHash: string): Promise<StoredPasswordResetToken | null> {
    return [...this.passwordResetTokens.values()].find((token) => token.token_hash === tokenHash) ?? null;
  }

  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    const token = this.passwordResetTokens.get(tokenId);
    if (token) {
      token.used_at = new Date();
    }
  }

  async invalidatePasswordResetTokensForUser(userId: string): Promise<void> {
    for (const token of this.passwordResetTokens.values()) {
      if (token.user_id === userId && token.used_at === null) {
        token.used_at = new Date();
      }
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

function createApp(repository: InMemoryAuthRepository, emailService: FakeEmailService) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(createConfig(), repository, emailService));
  return app;
}

function readTokenFromUrl(urlString: string): string {
  return new URL(urlString).searchParams.get('token') ?? '';
}

describe('auth router', () => {
  let repository: InMemoryAuthRepository;
  let emailService: FakeEmailService;
  let app: express.Express;

  beforeEach(() => {
    repository = new InMemoryAuthRepository();
    emailService = new FakeEmailService();
    app = createApp(repository, emailService);
  });

  it('registers users with normalized email and hashed password', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ firstName: 'José', lastName: 'Nuñez-Smith', email: ' User@Example.com ', password: 'password-password' });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('user@example.com');

    const storedUser = [...repository.users.values()][0];
    const storedProfile = [...repository.profiles.values()][0];
    expect(storedUser.email).toBe('user@example.com');
    expect(storedUser.password_hash).not.toBe('password-password');
    expect(storedProfile.first_name).toBe('José');
    expect(storedProfile.last_name).toBe('Nuñez-Smith');
    expect(storedProfile.display_name).toBe('José Nuñez-Smith');
    expect(emailService.verificationUrls).toHaveLength(1);
  });

  it('verifies email before login', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    const verificationToken = readTokenFromUrl(emailService.verificationUrls[0].verificationUrl);
    const verifyResponse = await request(app)
      .post('/api/auth/verify-email')
      .set('Origin', 'https://app.example.com')
      .send({ token: verificationToken });

    expect(verifyResponse.status).toBe(200);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.authenticated).toBe(true);
    expect(loginResponse.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects duplicate email registration', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    const duplicateResponse = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'USER@example.com', password: 'password-password' });

    expect(duplicateResponse.status).toBe(409);
  });

  it('rejects invalid logins with a generic error', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'missing@example.com', password: 'password-password' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid email or password');
  });

  it('resets a password and revokes existing sessions', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    const verificationToken = readTokenFromUrl(emailService.verificationUrls[0].verificationUrl);
    await request(app).post('/api/auth/verify-email').set('Origin', 'https://app.example.com').send({ token: verificationToken });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    expect(loginResponse.status).toBe(200);

    await request(app)
      .post('/api/auth/forgot-password')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com' });

    const resetToken = readTokenFromUrl(emailService.resetUrls[0].resetUrl);
    const resetResponse = await request(app)
      .post('/api/auth/reset-password')
      .set('Origin', 'https://app.example.com')
      .send({ token: resetToken, password: 'new-password-password' });

    expect(resetResponse.status).toBe(200);

    const oldPasswordLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    const newPasswordLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'new-password-password' });

    expect(oldPasswordLogin.status).toBe(401);
    expect(newPasswordLogin.status).toBe(200);
  });

  it('logs out the current session and revokes every session for the user', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    const verificationToken = readTokenFromUrl(emailService.verificationUrls[0].verificationUrl);
    await request(app).post('/api/auth/verify-email').set('Origin', 'https://app.example.com').send({ token: verificationToken });

    const firstAgent = request.agent(app);
    const firstLogin = await firstAgent
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    const firstSession = await firstAgent.get('/api/auth/session').set('Origin', 'https://app.example.com');

    const secondAgent = request.agent(app);
    const secondLogin = await secondAgent
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    const logoutAll = await firstAgent
      .post('/api/auth/logout-all')
      .set('Origin', 'https://app.example.com')
      .set('X-CSRF-Token', firstSession.body.csrfToken);

    expect(logoutAll.status).toBe(200);

    const firstAfterLogout = await firstAgent.get('/api/auth/session').set('Origin', 'https://app.example.com');
    const secondAfterLogout = await secondAgent.get('/api/auth/session').set('Origin', 'https://app.example.com');

    expect(firstAfterLogout.body.authenticated).toBe(false);
    expect(secondAfterLogout.body.authenticated).toBe(false);
    expect(firstLogin.headers['set-cookie']).toBeDefined();
    expect(secondLogin.headers['set-cookie']).toBeDefined();
  });

  it('blocks login for unverified accounts', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'unverified@example.com', password: 'password-password' });

    // Do NOT verify email; attempt login immediately
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'unverified@example.com', password: 'password-password' });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.error).toBe('Invalid email or password');
  });

  it('restores an authenticated session via GET /session', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    const verificationToken = readTokenFromUrl(emailService.verificationUrls[0].verificationUrl);
    await request(app).post('/api/auth/verify-email').set('Origin', 'https://app.example.com').send({ token: verificationToken });

    const agent = request.agent(app);
    await agent.post('/api/auth/login').set('Origin', 'https://app.example.com').send({ email: 'user@example.com', password: 'password-password' });

    const sessionResponse = await agent.get('/api/auth/session').set('Origin', 'https://app.example.com');

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.authenticated).toBe(true);
    expect(sessionResponse.body.user.email).toBe('user@example.com');
    expect(sessionResponse.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it('single-device logout does not revoke other active sessions', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'user@example.com', password: 'password-password' });

    const verificationToken = readTokenFromUrl(emailService.verificationUrls[0].verificationUrl);
    await request(app).post('/api/auth/verify-email').set('Origin', 'https://app.example.com').send({ token: verificationToken });

    const agentA = request.agent(app);
    const agentB = request.agent(app);

    await agentA.post('/api/auth/login').set('Origin', 'https://app.example.com').send({ email: 'user@example.com', password: 'password-password' });
    await agentB.post('/api/auth/login').set('Origin', 'https://app.example.com').send({ email: 'user@example.com', password: 'password-password' });

    const sessionA = await agentA.get('/api/auth/session').set('Origin', 'https://app.example.com');
    await agentA.post('/api/auth/logout').set('Origin', 'https://app.example.com').set('X-CSRF-Token', sessionA.body.csrfToken);

    const afterA = await agentA.get('/api/auth/session').set('Origin', 'https://app.example.com');
    const afterB = await agentB.get('/api/auth/session').set('Origin', 'https://app.example.com');

    expect(afterA.body.authenticated).toBe(false);
    expect(afterB.body.authenticated).toBe(true);
  });
});
