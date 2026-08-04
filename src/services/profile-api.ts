import type { StreamingServiceCatalogItem, UpdateUserProfileInput, UserProfile, UserStreamingService } from '@/types/profile';

import { requestJson } from './http-client';

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

export async function getMyStreamingServices(): Promise<{ services: UserStreamingService[]; catalog: StreamingServiceCatalogItem[] }> {
  return requestJson<{ services: UserStreamingService[]; catalog: StreamingServiceCatalogItem[] }>('/api/profile/streaming-services', {
    method: 'GET',
  });
}

export async function updateMyStreamingServices(providerIds: number[], csrfToken?: string | null): Promise<{ services: UserStreamingService[]; catalog: StreamingServiceCatalogItem[] }> {
  return requestJson<{ services: UserStreamingService[]; catalog: StreamingServiceCatalogItem[] }>('/api/profile/streaming-services', {
    method: 'PATCH',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
    body: JSON.stringify({ providerIds }),
  });
}
