import { requestJson } from './http-client';
import type { LibraryAction, LibraryListResponse, LibraryState } from '@/types/library';
import type { MediaType } from '@/types/recommendations';

interface ListParams {
  page?: number;
  pageSize?: number;
  sort?: 'updated_desc' | 'added_desc';
}

function buildListQuery(params?: ListParams): string {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.sort) query.set('sort', params.sort);
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export async function getMyWatchlist(params?: ListParams): Promise<LibraryListResponse> {
  return requestJson<LibraryListResponse>(`/api/library/watchlist${buildListQuery(params)}`, { method: 'GET' });
}

export async function getMyWatched(params?: ListParams): Promise<LibraryListResponse> {
  return requestJson<LibraryListResponse>(`/api/library/watched${buildListQuery(params)}`, { method: 'GET' });
}

export async function getMyLibraryStates(
  titles: { tmdbId: number; mediaType: MediaType }[],
): Promise<{ states: LibraryState[] }> {
  return requestJson<{ states: LibraryState[] }>('/api/library/states', {
    method: 'POST',
    body: JSON.stringify({ titles }),
  });
}

export async function updateMyLibraryAction(
  input: { tmdbId: number; mediaType: MediaType; action: LibraryAction; recommendationRequestId?: string },
  csrfToken?: string | null,
): Promise<{ ok: boolean; state: LibraryState | null }> {
  return requestJson<{ ok: boolean; state: LibraryState | null }>('/api/library/action', {
    method: 'POST',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
    body: JSON.stringify(input),
  });
}

export async function clearMyWatchlist(csrfToken?: string | null): Promise<{ ok: boolean; count: number }> {
  return requestJson<{ ok: boolean; count: number }>('/api/library/watchlist', {
    method: 'DELETE',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
  });
}

export async function clearMyWatched(csrfToken?: string | null): Promise<{ ok: boolean; count: number }> {
  return requestJson<{ ok: boolean; count: number }>('/api/library/watched', {
    method: 'DELETE',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
  });
}
