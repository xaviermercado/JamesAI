import type { Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';

import type { AppConfig } from '../config/env';
import { clearSessionCookie, getSessionCookieOptions, setSessionCookie } from './auth-cookie';
import { AUTH_CSRF_HEADER_NAME, AUTH_SESSION_COOKIE_NAME, createCsrfToken, hashSessionToken, timingSafeStringEqual } from './auth-crypto';
import { emailOnlySchema, loginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from './auth-schemas';
import type { AuthRepositoryLike } from './auth-repository';
import { AuthService } from './auth-service';
import type { EmailService } from '../email/email-service';
import { logger } from '../utils/logger';

function buildCookieContext(req: Request) {
  const forwardedProtoHeader = req.get('x-forwarded-proto');
  const requestProtocol = forwardedProtoHeader?.split(',')[0]?.trim() || req.protocol;
  const requestHost = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host') || undefined;

  return {
    requestOrigin: req.headers.origin,
    requestProtocol,
    requestHost,
  };
}

function readCookieHeader(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

function isAllowedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin || !config.frontendOrigin) {
    return true;
  }

  return origin === config.frontendOrigin;
}

function getSessionTokenFromRequest(req: Request): string | null {
  return readCookieHeader(req.headers.cookie, AUTH_SESSION_COOKIE_NAME);
}

function getCsrfTokenFromRequest(req: Request): string | null {
  const header = req.get(AUTH_CSRF_HEADER_NAME);
  return header?.trim() || null;
}

function requireCsrf(req: Request, res: Response, sessionTokenHash: string, config: AppConfig): boolean {
  const csrfToken = getCsrfTokenFromRequest(req);
  if (!csrfToken) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  const expectedToken = createCsrfToken(sessionTokenHash, config.sessionTokenPepper ?? '');
  if (!timingSafeStringEqual(expectedToken, csrfToken)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  return true;
}

function logAuthRouteError(route: string, req: Request, error: unknown): void {
  logger.error('auth.route_error', {
    route,
    method: req.method,
    path: req.path,
    error,
  });
}

function setNoStoreHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.append('Vary', 'Origin');
  res.append('Vary', 'Cookie');
}

export function createAuthRouter(config: AppConfig, repository: AuthRepositoryLike, emailService?: EmailService) {
  const router = express.Router();
  const authService = new AuthService(repository, config, emailService);
  const isProduction = config.nodeEnv === 'production';

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 10 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
  });

  const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 5 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
  });

  router.use((req, res, next) => {
    if (req.path === '/session' || req.path === '/login' || req.path === '/logout' || req.path === '/logout-all') {
      setNoStoreHeaders(res);
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isAllowedOrigin(req.headers.origin, config)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  });

  router.post('/register', registerLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    try {
      const result = await authService.register(parsed.data);
      return res.status(201).json({ user: result.user });
    } catch (error) {
      logAuthRouteError('/register', req, error);
      if (error instanceof Error && /duplicate email/i.test(error.message)) {
        return res.status(409).json({ error: 'An account with this email already exists. Sign in or reset your password.' });
      }

      return res.status(409).json({ error: 'Unable to create account' });
    }
  });

  router.post('/verify-email', async (req, res) => {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    try {
      await authService.verifyEmail(parsed.data.token);
      return res.json({ ok: true });
    } catch (error) {
      logAuthRouteError('/verify-email', req, error);
      return res.status(400).json({ error: 'Verification token is invalid or expired' });
    }
  });

  router.post('/resend-verification', async (req, res) => {
    const parsed = emailOnlySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    try {
      await authService.resendVerification(parsed.data.email);
      return res.json({ ok: true });
    } catch (error) {
      logAuthRouteError('/resend-verification', req, error);
      return res.status(500).json({ error: 'Unable to send verification email' });
    }
  });

  router.post('/forgot-password', async (req, res) => {
    const parsed = emailOnlySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    try {
      await authService.forgotPassword(parsed.data.email);
      return res.json({ ok: true });
    } catch (error) {
      logAuthRouteError('/forgot-password', req, error);
      return res.status(500).json({ error: 'Unable to send password reset email' });
    }
  });

  router.post('/reset-password', async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    try {
      await authService.resetPassword(parsed.data.token, parsed.data.password);
      return res.json({ ok: true });
    } catch (error) {
      logAuthRouteError('/reset-password', req, error);
      return res.status(400).json({ error: 'Password reset token is invalid or expired' });
    }
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    try {
      const result = await authService.login({
        ...parsed.data,
        deviceLabel: req.get('user-agent')?.slice(0, 120) ?? null,
        clientPlatform: 'web',
      });

      if (!result.sessionToken || !result.identity) {
        return res.status(500).json({ error: 'Unable to create session' });
      }

      setSessionCookie(res, result.sessionToken, config, buildCookieContext(req));
      return res.json({ authenticated: true, user: result.user, csrfToken: result.identity.csrfToken });
    } catch (error) {
      logAuthRouteError('/login', req, error);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
  });

  router.get('/session', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.json({ authenticated: false, user: null, csrfToken: null });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        clearSessionCookie(res, config, buildCookieContext(req));
        return res.json({ authenticated: false, user: null, csrfToken: null });
      }

      return res.json({ authenticated: true, user: restored.user, csrfToken: restored.identity.csrfToken });
    } catch (error) {
      logAuthRouteError('/session', req, error);
      clearSessionCookie(res, config, buildCookieContext(req));
      return res.json({ authenticated: false, user: null, csrfToken: null });
    }
  });

  router.post('/logout', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      clearSessionCookie(res, config, buildCookieContext(req));
      return res.json({ ok: true });
    }

    const sessionTokenHash = hashSessionToken(sessionToken, config.sessionTokenPepper ?? '');
    const restored = await authService.restoreSession(sessionToken);
    if (!restored.authenticated || !restored.identity) {
      clearSessionCookie(res, config, buildCookieContext(req));
      return res.json({ ok: true });
    }

    if (!requireCsrf(req, res, sessionTokenHash, config)) {
      return undefined;
    }

    try {
      await authService.logout(sessionToken);
      clearSessionCookie(res, config, buildCookieContext(req));
      return res.json({ ok: true });
    } catch (error) {
      logAuthRouteError('/logout', req, error);
      return res.status(500).json({ error: 'Unable to sign out right now' });
    }
  });

  router.post('/logout-all', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      clearSessionCookie(res, config, buildCookieContext(req));
      return res.json({ ok: true });
    }

    const restored = await authService.restoreSession(sessionToken);
    if (!restored.authenticated || !restored.identity) {
      clearSessionCookie(res, config, buildCookieContext(req));
      return res.json({ ok: true });
    }

    if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) {
      return undefined;
    }

    try {
      await authService.logoutAll(restored.identity.userId);
      clearSessionCookie(res, config, buildCookieContext(req));
      return res.json({ ok: true });
    } catch (error) {
      logAuthRouteError('/logout-all', req, error);
      return res.status(500).json({ error: 'Unable to revoke sessions right now' });
    }
  });

  return router;
}
