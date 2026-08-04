import { requestJson } from './http-client';
import type { AuthSessionResponse, LoginInput, SafeUser, SignupInput } from '@/types/auth';

export async function getAuthSession(): Promise<AuthSessionResponse> {
  return requestJson<AuthSessionResponse>('/api/auth/session', { method: 'GET' });
}

export async function registerAuthAccount(input: SignupInput): Promise<{ user: SafeUser }> {
  return requestJson<{ user: SafeUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function loginAuthAccount(input: LoginInput): Promise<AuthSessionResponse> {
  return requestJson<AuthSessionResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
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
