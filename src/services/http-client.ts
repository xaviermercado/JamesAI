import { resolveApiBaseUrl } from './api-base-url';

const API_BASE_URL = resolveApiBaseUrl();

export class HttpRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

function notifyUnauthorizedResponse(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new Event('jamesai:unauthorized'));
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
    for (const fieldError of Object.values(errorValue as Record<string, unknown>)) {
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

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
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
    const message = extractApiErrorMessage(payload);
    if (response.status === 401) {
      notifyUnauthorizedResponse();
    }
    throw new HttpRequestError(message, response.status);
  }

  return response.json() as Promise<T>;
}