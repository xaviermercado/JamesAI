import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const AUTH_SESSION_COOKIE_NAME = 'jamesai_session';
export const AUTH_CSRF_HEADER_NAME = 'x-csrf-token';
export const AUTH_CSRF_COOKIE_NAME = 'jamesai_csrf';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string, pepper: string): string {
  return createHmac('sha256', pepper).update(token).digest('hex');
}

export function createCsrfToken(sessionTokenHash: string, pepper: string): string {
  return createHmac('sha256', pepper).update(`csrf:${sessionTokenHash}`).digest('hex');
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
