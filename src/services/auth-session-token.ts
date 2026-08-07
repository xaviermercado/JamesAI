const SESSION_TOKEN_KEY = 'jamesai.sessionToken';

let inMemorySessionToken: string | null = null;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getAuthSessionToken(): string | null {
  if (inMemorySessionToken) {
    return inMemorySessionToken;
  }

  if (!canUseStorage()) {
    return null;
  }

  const stored = window.localStorage.getItem(SESSION_TOKEN_KEY);
  inMemorySessionToken = stored && stored.trim().length > 0 ? stored : null;
  return inMemorySessionToken;
}

export function setAuthSessionToken(token: string | null | undefined): void {
  const normalized = token?.trim() ? token.trim() : null;
  inMemorySessionToken = normalized;

  if (!canUseStorage()) {
    return;
  }

  if (!normalized) {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_TOKEN_KEY, normalized);
}

export function clearAuthSessionToken(): void {
  inMemorySessionToken = null;
  if (canUseStorage()) {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}
