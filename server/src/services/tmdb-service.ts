import { URL, URLSearchParams } from 'node:url';

import type {
  MovieCandidate,
  RecommendationRequest,
  RecommendationResponse,
} from '../types/recommendations';
import { OpenAiService } from './openai-service';

export interface TmdbConfig {
  apiToken: string;
  baseUrl: string;
  timeoutMs: number;
}

interface TmdbDiscoverMovieResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  overview?: string;
}

interface TmdbMovieDetailsResult {
  id: number;
  title?: string;
  name?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  genres?: Array<{ id: number; name: string }>;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  overview?: string;
}

interface TmdbWatchProviderResponse {
  results?: Record<string, { flatrate?: Array<{ provider_name?: string }> }>;
}

interface TmdbDiscoverResponse {
  results?: TmdbDiscoverMovieResult[];
  total_results?: number;
}

const providerNameToIdMap: Record<string, string> = {
  netflix: '8',
  'prime video': '9',
  'apple tv+': '2',
  disney: '337',
  'disney+': '337',
  max: '1899',
  paramount: '531',
  'paramount+': '531',
  hulu: '15',
  peacock: '386',
};

export class TmdbService {
  constructor(
    private readonly config: TmdbConfig,
    private readonly openAiService?: OpenAiService,
  ) {}

  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    const params = this.buildDiscoverParams(request);
    const discoverUrl = `${this.config.baseUrl}/discover/${request.mediaType ?? 'movie'}`;
    const discoverResponse = await this.requestJson<TmdbDiscoverResponse>(discoverUrl, params);
    const candidates = (discoverResponse.results ?? []).filter(
      (candidate) => !request.excludedMovieIds?.includes(candidate.id),
    );
    const realCandidates = await this.enrichCandidates(candidates.slice(0, 10), request);
    const rankedCandidates = this.openAiService
      ? await this.openAiService.rankCandidates(request, realCandidates)
      : realCandidates.slice(0, 5).map((candidate) => ({
          ...candidate,
          explanation: this.buildTemporaryExplanation(candidate, request),
        }));

    return {
      recommendations: rankedCandidates,
      source: 'live',
    };
  }

  private buildDiscoverParams(request: RecommendationRequest): URLSearchParams {
    const params = new URLSearchParams({
      include_adult: 'false',
      include_video: 'false',
      language: 'en-US',
      sort_by: 'popularity.desc',
      page: '1',
    });

    if (request.maxRuntime) {
      params.set('with_runtime.lte', String(request.maxRuntime));
    }

    if (request.country) {
      params.set('watch_region', request.country);
    }

    if (request.streamingServices?.length) {
      const providerIds = request.streamingServices
        .map((service) => providerNameToIdMap[service.toLowerCase()])
        .filter(Boolean);
      if (providerIds.length) {
        params.set('with_watch_providers', providerIds.join('|'));
      }
    }

    if (request.excludedMovieIds?.length) {
      params.set('exclude_movie_ids', request.excludedMovieIds.join(','));
    }

    return params;
  }

  private async enrichCandidates(
    candidates: TmdbDiscoverMovieResult[],
    request: RecommendationRequest,
  ): Promise<MovieCandidate[]> {
    const results: MovieCandidate[] = [];

    for (const candidate of candidates) {
      const details = await this.requestJson<TmdbMovieDetailsResult>(
        `${this.config.baseUrl}/${request.mediaType ?? 'movie'}/${candidate.id}`,
        { language: 'en-US' },
      );

      const providers = await this.getWatchProviders(candidate.id, request.mediaType ?? 'movie', request.country);
      const title = details.title ?? details.name ?? candidate.title ?? candidate.name ?? 'Untitled';
      const releaseDate = details.release_date ?? details.first_air_date ?? '';
      const releaseYear = releaseDate ? Number(releaseDate.slice(0, 4)) : 0;
      const runtime = details.runtime ?? details.episode_run_time?.[0] ?? 0;
      const genres = (details.genres ?? []).map((genre) => genre.name);
      const posterUrl = details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : '';

      results.push({
        tmdbMovieId: candidate.id,
        title,
        posterUrl,
        releaseYear,
        runtimeMinutes: runtime,
        tmdbRating: details.vote_average ?? 0,
        genres,
        providers,
        country: request.country ?? 'Unknown',
        mediaType: request.mediaType ?? 'movie',
      });
    }

    return results;
  }

  async getMovieProviders(movieId: number, mediaType: 'movie' | 'tv', country?: string): Promise<string[]> {
    return this.getWatchProviders(movieId, mediaType, country);
  }

  private async getWatchProviders(id: number, mediaType: 'movie' | 'tv', country?: string): Promise<string[]> {
    const url = `${this.config.baseUrl}/${mediaType}/${id}/watch/providers`;
    const providersResponse = await this.requestJson<TmdbWatchProviderResponse>(url, {});
    const region = country?.toUpperCase();
    const regionProviders = region ? providersResponse.results?.[region] : undefined;
    const flatrate = regionProviders?.flatrate ?? [];

    return flatrate.map((provider) => provider.provider_name ?? 'Unknown').filter(Boolean);
  }

  private buildTemporaryExplanation(candidate: MovieCandidate, request: RecommendationRequest): string {
    const parts = [
      `This is a real TMDB result that fits the request for ${request.mediaType ?? 'movie'} content.`,
      request.maxRuntime ? `It stays within ${request.maxRuntime} minutes.` : 'It was surfaced from broad discovery results.',
      request.country ? `The watch-provider lookup uses ${request.country}.` : 'Provider availability is based on the current lookup.',
    ];

    return `${parts.join(' ')} Explanation will be refined once OpenAI is added.`;
  }

  private async requestJson<T>(url: string, params: Record<string, string> | URLSearchParams): Promise<T> {
    const searchParams = params instanceof URLSearchParams ? params : new URLSearchParams(params);
    const target = new URL(url);
    target.search = searchParams.toString();
    const headers = {
      Authorization: `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(target.toString(), {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('TMDB rate limit exceeded');
        }
        if (response.status >= 500) {
          throw new Error('TMDB service unavailable');
        }
        throw new Error(`TMDB request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as T;
      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('TMDB request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
