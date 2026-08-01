export type MediaType = 'movie' | 'tv';

export interface RecommendationRequest {
  description: string;
  mediaType?: MediaType;
  maxRuntime?: number | null;
  country?: string;
  streamingServices?: string[];
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
}

export interface MovieRecommendation extends MovieCandidate {
  explanation: string;
}

export interface RecommendationResponse {
  recommendations: MovieRecommendation[];
  source: 'mock' | 'live';
}
