export type MediaType = 'movie' | 'tv';

export interface RecommendationRequest {
  description: string;
  mediaType?: MediaType;
  maxRuntime?: number | null;
  /** Temporary market override (ISO 3166-1 alpha-2). Server merges with saved preference when absent. */
  country?: string;
  /** Legacy name-based provider list. Prefer providerIds when available. */
  streamingServices?: string[];
  /** Temporary TMDB provider IDs. undefined = inherit saved; [] = explicitly any service. */
  providerIds?: number[];
  /** Temporary original-language codes (ISO 639-1). undefined = inherit saved; [] = any language. */
  originalLanguages?: string[];
  excludedMovieIds?: number[];
  /** Server-generated, bounded editorial data. It is never accepted from the public API. */
  editorialContext?: string;
}

export interface ParsedMovieCriteria {
  mediaType?: MediaType;
  mood?: string;
  includeGenres?: string[];
  excludeGenres?: string[];
  minYear?: number;
  maxYear?: number;
  maxRuntime?: number;
  country?: string;
  streamingServices?: string[];
}

export interface MovieCandidate {
  tmdbMovieId: number;
  title: string;
  posterUrl: string;
  releaseYear: number;
  runtimeMinutes: number;
  tmdbRating: number;
  genres: string[];
  providers: string[];
  country: string;
  mediaType: MediaType;
  originalLanguage?: string;
}

export interface MovieRecommendation extends MovieCandidate {
  explanation: string;
}

export interface RecommendationResponse {
  recommendations: MovieRecommendation[];
  source: 'mock' | 'live';
  /** Whether any saved profile preferences were applied to this request. */
  preferencesApplied: boolean;
  /** Whether learned signals from explicit feedback were applied to ranking. */
  feedbackPersonalizationApplied?: boolean;
  /** Concise context for the frontend. Safe to display. */
  preferenceContext?: {
    market?: string;
    providerCount?: number;
    languageCount?: number;
  };
}
