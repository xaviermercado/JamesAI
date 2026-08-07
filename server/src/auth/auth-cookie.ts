import type { CookieOptions, Response } from 'express';

import type { AppConfig } from '../config/env';
import { AUTH_SESSION_COOKIE_NAME } from './auth-crypto';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionCookieContext {
  requestOrigin?: string;
  requestHost?: string;
  requestProtocol?: string;
}

function normalizeProtocol(value: string): string {
  return value.replace(/:$/, '').toLowerCase();
}

function isIpLikeHost(hostname: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':');
}

function siteFromHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || normalized === 'localhost' || isIpLikeHost(normalized)) {
    return normalized;
  }

  const labels = normalized.split('.').filter(Boolean);
  if (labels.length <= 2) {
    return normalized;
  }

  return labels.slice(-2).join('.');
}

function isCrossSiteRequest(context?: SessionCookieContext): boolean {
  if (!context?.requestOrigin || !context.requestHost) {
    return false;
  }

  try {
    const originUrl = new URL(context.requestOrigin);
    const requestProtocol = normalizeProtocol(context.requestProtocol ?? originUrl.protocol);
    const apiUrl = new URL(`${requestProtocol}://${context.requestHost}`);

    if (normalizeProtocol(originUrl.protocol) !== normalizeProtocol(apiUrl.protocol)) {
      return true;
    }

    return siteFromHostname(originUrl.hostname) !== siteFromHostname(apiUrl.hostname);
  } catch {
    return false;
  }
}

export function resolveSameSite(config: AppConfig, context?: SessionCookieContext): CookieOptions['sameSite'] {
  const crossSiteRequest = isCrossSiteRequest(context);

  // Cross-site frontend -> API requests require SameSite=None for the session
  // cookie to be sent on XHR/fetch after login and during session restoration.
  // Enforce this even when a stricter env override was applied accidentally.
  if (config.nodeEnv === 'production' && crossSiteRequest) {
    return 'none';
  }

  if (config.authCookieSameSite) {
    return config.authCookieSameSite;
  }

  return 'lax';
}

function shouldUsePartitionedCookie(config: AppConfig, context?: SessionCookieContext): boolean {
  return config.nodeEnv === 'production' && isCrossSiteRequest(context);
}

function resolveSecure(config: AppConfig, context?: SessionCookieContext): boolean {
  // SameSite=None is only valid on Secure cookies — enforce this automatically.
  const sameSite = resolveSameSite(config, context);
  if (sameSite === 'none') return true;
  return config.nodeEnv === 'production';
}

export function getSessionCookieOptions(config: AppConfig, context?: SessionCookieContext): CookieOptions {
  const options: CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    secure: resolveSecure(config, context),
    sameSite: resolveSameSite(config, context),
    domain: config.authCookieDomain,
    path: '/',
    maxAge: SESSION_TTL_MS,
  };

  if (shouldUsePartitionedCookie(config, context)) {
    options.partitioned = true;
  }

  return options;
}

export function setSessionCookie(res: Response, token: string, config: AppConfig, context?: SessionCookieContext): void {
  res.cookie(AUTH_SESSION_COOKIE_NAME, token, getSessionCookieOptions(config, context));
}

export function clearSessionCookie(res: Response, config: AppConfig, context?: SessionCookieContext): void {
  res.clearCookie(AUTH_SESSION_COOKIE_NAME, getSessionCookieOptions(config, context));
}

export function getSessionTtlMs(): number {
  return SESSION_TTL_MS;
}
