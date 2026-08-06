import type { MediaType } from '@/types/recommendations';

export type LibraryStatus = 'watchlist' | 'watched';

export type LibraryAction = 'add_watchlist' | 'mark_watched' | 'mark_unwatched' | 'remove';

export interface LibraryState {
  tmdbId: number;
  mediaType: MediaType;
  status: LibraryStatus;
  addedAt: string;
  watchedAt: string | null;
  updatedAt: string;
}

export interface LibraryMetadata {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterUrl: string;
  releaseYear: number;
  runtimeMinutes: number;
  tmdbRating: number;
  genres: string[];
  providers: string[];
  country: string;
  metadataUnavailable?: boolean;
}

export interface LibraryListItem extends LibraryState {
  metadata: LibraryMetadata;
}

export interface LibraryListResponse {
  page: number;
  pageSize: number;
  total: number;
  items: LibraryListItem[];
}
