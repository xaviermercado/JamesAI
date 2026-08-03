import type { Request, Response } from 'express';
import express from 'express';

import type { AppConfig } from '../config/env';
import { AuthService } from '../auth/auth-service';
import { AUTH_CSRF_HEADER_NAME, AUTH_SESSION_COOKIE_NAME, createCsrfToken, timingSafeStringEqual } from '../auth/auth-crypto';
import type { AuthRepositoryLike } from '../auth/auth-repository';
import { updateProfileSchema } from './profile-schemas';
import type { ProfileRepositoryLike } from './profile-repository';
import { toApiProfile } from './profile-repository';
import { logger } from '../utils/logger';

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

function getSessionTokenFromRequest(req: Request): string | null {
  return readCookieHeader(req.headers.cookie, AUTH_SESSION_COOKIE_NAME);
}

function getCsrfTokenFromRequest(req: Request): string | null {
  const header = req.get(AUTH_CSRF_HEADER_NAME);
  return header?.trim() || null;
}

function isAllowedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin || !config.frontendOrigin) {
    return true;
  }

  return origin === config.frontendOrigin;
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

function logProfileRouteError(route: string, req: Request, error: unknown): void {
  logger.error('profile.route_error', {
    route,
    method: req.method,
    path: req.path,
    error,
  });
}

export function createProfileRouter(config: AppConfig, authRepository: AuthRepositoryLike, profileRepository: ProfileRepositoryLike) {
  const router = express.Router();
  const authService = new AuthService(authRepository, config);

  router.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isAllowedOrigin(req.headers.origin, config)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  });

  router.get('/', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const profile = await profileRepository.findByUserId(restored.identity.userId);
      return res.json({ profile: profile ? toApiProfile(profile) : null });
    } catch (error) {
      logProfileRouteError('/', req, error);
      return res.status(500).json({ error: 'Unable to load profile right now' });
    }
  });

  router.patch('/', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) {
        return undefined;
      }

      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const saved = await profileRepository.upsert(restored.identity.userId, {
        displayName: parsed.data.displayName,
        countryCode: parsed.data.countryCode,
        avatarUrl: parsed.data.avatarUrl ?? null,
        letterboxdUsername: parsed.data.letterboxdUsername ?? null,
        letterboxdProfileUrl: parsed.data.letterboxdProfileUrl ?? null,
        tvtimeUsername: parsed.data.tvtimeUsername ?? null,
        tvtimeProfileUrl: parsed.data.tvtimeProfileUrl ?? null,
      });

      return res.json({ profile: toApiProfile(saved) });
    } catch (error) {
      logProfileRouteError('/', req, error);
      return res.status(500).json({ error: 'Unable to save profile right now' });
    }
  });

  return router;
}
