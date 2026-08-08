import type {
  LetterboxdSyncStatus,
  ContentLanguageSelection,
  PreferencesCatalog,
  StreamingServiceCatalogItem,
  UpdatePreferencesInput,
  UpdateUserProfileInput,
  UserPreferences,
  UserProfile,
  UserStreamingService,
} from '@/types/profile';

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

export async function getMyContentLanguages(): Promise<{ languages: ContentLanguageSelection[] }> {
  return requestJson<{ languages: ContentLanguageSelection[] }>('/api/profile/content-languages', { method: 'GET' });
}

export async function updateMyContentLanguages(languageCodes: string[], csrfToken?: string | null): Promise<{ languages: ContentLanguageSelection[] }> {
  return requestJson<{ languages: ContentLanguageSelection[] }>('/api/profile/content-languages', {
    method: 'PATCH',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
    body: JSON.stringify({ languageCodes }),
  });
}

export async function getMyPreferences(): Promise<UserPreferences & { catalog: PreferencesCatalog }> {
  return requestJson<UserPreferences & { catalog: PreferencesCatalog }>('/api/profile/preferences', { method: 'GET' });
}

export async function updateMyPreferences(input: UpdatePreferencesInput, csrfToken?: string | null): Promise<UserPreferences> {
  return requestJson<UserPreferences>('/api/profile/preferences', {
    method: 'PATCH',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
    body: JSON.stringify(input),
  });
}

export async function getPreferenceReferenceData(): Promise<PreferencesCatalog> {
  return requestJson<PreferencesCatalog>('/api/profile/reference', { method: 'GET' });
}

export async function getProviderCatalogForCountry(countryCode: string): Promise<{
  marketCode: string;
  availabilityKnown: boolean;
  providers: StreamingServiceCatalogItem[];
}> {
  const query = new URLSearchParams({ country: countryCode.trim().toUpperCase() });
  return requestJson<{
    marketCode: string;
    availabilityKnown: boolean;
    providers: StreamingServiceCatalogItem[];
  }>(`/api/profile/providers?${query.toString()}`, { method: 'GET' });
}

export async function getLetterboxdStatus(): Promise<{ status: LetterboxdSyncStatus }> {
  return requestJson<{ status: LetterboxdSyncStatus }>('/api/profile/letterboxd/status', { method: 'GET' });
}

export async function updateLetterboxdSettings(
  publicActivityEnabled: boolean,
  csrfToken?: string | null,
): Promise<{ status: LetterboxdSyncStatus }> {
  return requestJson<{ status: LetterboxdSyncStatus }>('/api/profile/letterboxd/settings', {
    method: 'PATCH',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
    body: JSON.stringify({ publicActivityEnabled }),
  });
}

export async function refreshLetterboxdActivity(csrfToken?: string | null): Promise<{
  refreshed: boolean;
  changed: boolean;
  importedCount: number;
  status: LetterboxdSyncStatus;
}> {
  return requestJson<{
    refreshed: boolean;
    changed: boolean;
    importedCount: number;
    status: LetterboxdSyncStatus;
  }>('/api/profile/letterboxd/refresh', {
    method: 'POST',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
  });
}
