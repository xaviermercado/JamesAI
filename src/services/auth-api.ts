import { resolveApiBaseUrl } from './api-base-url';

const API_BASE_URL = resolveApiBaseUrl();

export interface SafeUser {
  userId: string;
  email: string;
  emailVerifiedAt: string | null;
  accountStatus: 'pending_verification' | 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: SafeUser | null;
  csrfToken: string | null;
}

function extractApiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'Request failed';
  }

  const errorValue = (payload as { error?: unknown }).error;
  if (typeof errorValue === 'string' && errorValue.trim()) {
    return errorValue;
  }

  if (errorValue && typeof errorValue === 'object') {
    const fieldErrors = Object.values(errorValue as Record<string, unknown>);
    for (const fieldError of fieldErrors) {
      if (Array.isArray(fieldError)) {
        const first = fieldError.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
        if (first) {
          return first;
        }
      }
    }
  }

  return 'Request failed';
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(extractApiErrorMessage(payload));
  }

  return response.json() as Promise<T>;
}

export async function getAuthSession(): Promise<AuthSessionResponse> {
  return requestJson<AuthSessionResponse>('/api/auth/session', { method: 'GET' });
}

export async function registerAuthAccount(email: string, password: string): Promise<{ user: SafeUser }> {
  return requestJson<{ user: SafeUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function loginAuthAccount(email: string, password: string): Promise<AuthSessionResponse> {
  return requestJson<AuthSessionResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logoutAuthAccount(csrfToken: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
}

export async function logoutAllAuthDevices(csrfToken: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>('/api/auth/logout-all', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
}

export async function verifyAuthEmailToken(token: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendVerificationEmail(email: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetAuthPassword(token: string, password: string): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}
