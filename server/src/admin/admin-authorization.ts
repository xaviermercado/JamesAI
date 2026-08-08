import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { AppConfig } from '../config/env';
import { AUTH_CSRF_HEADER_NAME, createCsrfToken, timingSafeStringEqual } from '../auth/auth-crypto';
import { getSessionTokenFromRequest } from '../auth/auth-request';
import type { AuthService } from '../auth/auth-service';
import type { AuthIdentity, SafeUser } from '../auth/auth-types';
import {
  hasAdminCapability,
  isAdminCapability,
  isHighImpactAdminCapability,
  type AdminCapability,
} from './admin-permissions';

export const RECENT_REAUTHENTICATION_WINDOW_MS = 15 * 60 * 1000;

const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface AdminAuthorizationContext {
  capability: AdminCapability;
  user: SafeUser;
  identity: AuthIdentity;
}

export interface AdminAuthSessionService {
  restoreSession: AuthService['restoreSession'];
}

export interface AdminAuthorizationOptions {
  now?: () => Date;
}

export interface AdminAuthorization {
  requireCapability(capability: string): RequestHandler;
  getContext(res: Response): AdminAuthorizationContext | null;
}

function denyUnauthorized(res: Response): void {
  res.status(401).json({ error: 'Unauthorized' });
}

function denyForbidden(res: Response): void {
  res.status(403).json({ error: 'Forbidden' });
}

function hasValidCsrf(req: Request, identity: AuthIdentity, config: Pick<AppConfig, 'sessionTokenPepper'>): boolean {
  const suppliedToken = req.get(AUTH_CSRF_HEADER_NAME)?.trim();
  if (!suppliedToken) {
    return false;
  }

  const expectedToken = createCsrfToken(identity.sessionTokenHash, config.sessionTokenPepper ?? '');
  return timingSafeStringEqual(expectedToken, suppliedToken);
}

function hasRecentReauthentication(authenticatedAt: string | null, now: Date): boolean {
  if (!authenticatedAt) {
    return false;
  }

  const authenticatedAtMs = Date.parse(authenticatedAt);
  const ageMs = now.getTime() - authenticatedAtMs;
  return Number.isFinite(authenticatedAtMs) && ageMs >= 0 && ageMs <= RECENT_REAUTHENTICATION_WINDOW_MS;
}

export function createAdminAuthorization(
  authService: AdminAuthSessionService,
  config: Pick<AppConfig, 'sessionTokenPepper'>,
  options: AdminAuthorizationOptions = {},
): AdminAuthorization {
  const now = options.now ?? (() => new Date());

  return {
    requireCapability(capability: string): RequestHandler {
      return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!isAdminCapability(capability)) {
          denyForbidden(res);
          return;
        }

        const sessionToken = getSessionTokenFromRequest(req);
        if (!sessionToken) {
          denyUnauthorized(res);
          return;
        }

        let restored;
        try {
          restored = await authService.restoreSession(sessionToken);
        } catch {
          denyUnauthorized(res);
          return;
        }

        if (!restored.authenticated || !restored.user || !restored.identity) {
          denyUnauthorized(res);
          return;
        }

        if (restored.user.accountStatus !== 'active' || !hasAdminCapability(restored.user.adminRole, capability)) {
          denyForbidden(res);
          return;
        }

        if (!SAFE_HTTP_METHODS.has(req.method) && !hasValidCsrf(req, restored.identity, config)) {
          denyForbidden(res);
          return;
        }

        if (isHighImpactAdminCapability(capability) && !hasRecentReauthentication(restored.identity.authenticatedAt, now())) {
          denyForbidden(res);
          return;
        }

        res.locals.adminAuthorization = {
          capability,
          user: restored.user,
          identity: restored.identity,
        } satisfies AdminAuthorizationContext;
        next();
      };
    },

    getContext(res: Response): AdminAuthorizationContext | null {
      return (res.locals.adminAuthorization as AdminAuthorizationContext | undefined) ?? null;
    },
  };
}