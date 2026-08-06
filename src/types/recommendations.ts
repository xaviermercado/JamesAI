export type MediaType = 'movie' | 'tv';

export interface RecommendationRequest {
  description: string;
  mediaType?: MediaType;
  maxRuntime?: number | null;
  /** Temporary market override. Absent = server uses saved preference. */
  country?: string;
  /** Legacy name-based provider list (anonymous users). */
  streamingServices?: string[];
  /** Temporary TMDB provider IDs. [] = explicitly any service. Absent = server uses saved pref. */
  providerIds?: number[];
  /** Temporary language codes (ISO 639-1). [] = any language. Absent = server uses saved pref. */
  originalLanguages?: string[];
  excludedMovieIds?: number[];
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
  /** True when the server used at least one saved profile preference for this request. */
  preferencesApplied: boolean;
  /** True when learned signals from explicit feedback affected ranking order. */
  feedbackPersonalizationApplied?: boolean;
  preferenceContext?: {
    market?: string;
    providerCount?: number;
    languageCount?: number;
  };
}
