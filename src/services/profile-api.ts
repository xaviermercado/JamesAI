import { resolveApiBaseUrl } from './api-base-url';

const API_BASE_URL = resolveApiBaseUrl();

export interface UserProfile {
  displayName: string;
  countryCode: string;
  avatarUrl: string | null;
  letterboxdUsername: string | null;
  letterboxdProfileUrl: string | null;
  tvtimeUsername: string | null;
  tvtimeProfileUrl: string | null;
}

export interface UpdateUserProfileInput {
  displayName: string;
  countryCode: string;
  avatarUrl?: string | null;
  letterboxdUsername?: string | null;
  letterboxdProfileUrl?: string | null;
  tvtimeUsername?: string | null;
  tvtimeProfileUrl?: string | null;
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
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Request failed');
  }

  return response.json() as Promise<T>;
}

export async function getMyProfile(): Promise<{ profile: UserProfile | null }> {
  return requestJson<{ profile: UserProfile | null }>('/api/profile', { method: 'GET' });
}

export async function updateMyProfile(input: UpdateUserProfileInput, csrfToken?: string | null): Promise<{ profile: UserProfile }> {
  return requestJson<{ profile: UserProfile }>('/api/profile', {
    method: 'PATCH',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
    body: JSON.stringify(input),
  });
}
