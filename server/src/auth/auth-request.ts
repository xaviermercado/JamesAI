import type { Request } from 'express';

import { AUTH_SESSION_COOKIE_NAME } from './auth-crypto';

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

function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, ...valueParts] = authorizationHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer') {
    return null;
  }

  const token = valueParts.join(' ').trim();
  return token || null;
}

export function getSessionTokenFromRequest(req: Request): string | null {
  const bearer = readBearerToken(req.get('authorization'));
  if (bearer) {
    return bearer;
  }

  return readCookieHeader(req.headers.cookie, AUTH_SESSION_COOKIE_NAME);
}
