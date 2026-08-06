import type { CookieOptions, Response } from 'express';

import type { AppConfig } from '../config/env';
import { AUTH_SESSION_COOKIE_NAME } from './auth-crypto';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function resolveSameSite(config: AppConfig): CookieOptions['sameSite'] {
  if (config.authCookieSameSite) {
    return config.authCookieSameSite;
  }

  return config.nodeEnv === 'production' ? 'none' : 'lax';
}

function resolveSecure(config: AppConfig): boolean {
  // SameSite=None is only valid on Secure cookies — enforce this automatically.
  const sameSite = resolveSameSite(config);
  if (sameSite === 'none') return true;
  return config.nodeEnv === 'production';
}

export function getSessionCookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: resolveSecure(config),
    sameSite: resolveSameSite(config),
    domain: config.authCookieDomain,
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

export function setSessionCookie(res: Response, token: string, config: AppConfig): void {
  res.cookie(AUTH_SESSION_COOKIE_NAME, token, getSessionCookieOptions(config));
}

export function clearSessionCookie(res: Response, config: AppConfig): void {
  res.clearCookie(AUTH_SESSION_COOKIE_NAME, getSessionCookieOptions(config));
}

export function getSessionTtlMs(): number {
  return SESSION_TTL_MS;
}
