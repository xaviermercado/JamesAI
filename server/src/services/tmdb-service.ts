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

const descriptionGenreMap: Record<string, string> = {
  funny: '35',
  comedy: '35',
  romantic: '10749',
  romance: '10749',
  scary: '27',
  horror: '27',
  action: '28',
  thriller: '53',
  drama: '18',
  adventurous: '12',
  fantasy: '14',
  sci: '878',
  fiction: '878',
  family: '10751',
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
    const realCandidates = await this.enrichCandidates(candidates.slice(0, 12), request);
    const rankedCandidates = this.rankCandidates(request, realCandidates);
    const finalCandidates = this.openAiService
      ? await this.openAiService.rankCandidates(request, rankedCandidates)
      : rankedCandidates.slice(0, 5).map((candidate) => ({
          ...candidate,
          explanation: this.buildTemporaryExplanation(candidate, request),
        }));

    return {
      recommendations: finalCandidates,
      source: 'live',
    };
  }

  private rankCandidates(request: RecommendationRequest, candidates: MovieCandidate[]): MovieCandidate[] {
    const description = request.description?.toLowerCase() ?? '';
    const tokens = description
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

    const scoreCandidate = (candidate: MovieCandidate) => {
      const title = candidate.title?.toLowerCase() ?? '';
      const overview = '';
      const combinedText = [title, candidate.genres.join(' '), candidate.providers.join(' ')].join(' ').toLowerCase();
      const genreHits = candidate.genres.filter((genre) => tokens.some((token) => genre.toLowerCase().includes(token))).length;
      const providerHits = candidate.providers.filter((provider) => tokens.some((token) => provider.toLowerCase().includes(token))).length;
      const tokenHits = tokens.filter((token) => combinedText.includes(token)).length;
      const runtimeBonus = request.maxRuntime && candidate.runtimeMinutes > 0
        ? candidate.runtimeMinutes <= request.maxRuntime ? 2 : 0
        : 0;
      const dateBonus = /90s|nineties|1990|1990s/.test(description) && candidate.releaseYear >= 1990 && candidate.releaseYear < 2000 ? 2 : 0;
      const funBonus = /funny|comedy|light|feel good|date night|romantic|quirky|whimsical|heartfelt/.test(description) && candidate.genres.some((genre) => ['Comedy', 'Romance', 'Drama'].includes(genre)) ? 2 : 0;
      const qualityBonus = candidate.tmdbRating > 6.5 ? 1 : 0;
      const popularityBonus = candidate.tmdbRating > 7 ? 1 : 0;

      return tokenHits * 3 + genreHits * 2 + providerHits * 2 + runtimeBonus + dateBonus + funBonus + qualityBonus + popularityBonus;
    };

    return candidates
      .map((candidate) => ({ candidate, score: scoreCandidate(candidate) }))
      .sort((a, b) => b.score - a.score)
      .map(({ candidate }) => candidate);
  }

  private buildDiscoverParams(request: RecommendationRequest): URLSearchParams {
    const params = new URLSearchParams({
      include_adult: 'false',
      include_video: 'false',
      language: 'en-US',
      sort_by: 'popularity.desc',
      page: '1',
    });

    const description = request.description?.toLowerCase() ?? '';
    const matchedGenres = this.extractGenresFromDescription(description);
    if (matchedGenres.length) {
      params.set('with_genres', matchedGenres.join('|'));
    }

    const yearRange = this.extractYearRange(description);
    if (yearRange) {
      params.set('primary_release_date.gte', yearRange.start);
      params.set('primary_release_date.lte', yearRange.end);
    }

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

  private extractGenresFromDescription(description: string): string[] {
    const tokens = description.split(/[^a-z0-9]+/).filter(Boolean);
    const matched = new Set<string>();

    for (const token of tokens) {
      const genreId = descriptionGenreMap[token];
      if (genreId) {
        matched.add(genreId);
      }

      if (token.includes('funny') || token.includes('comedy')) {
        matched.add('35');
      }
      if (token.includes('date')) {
        matched.add('10749');
      }
    }

    return Array.from(matched);
  }

  private extractYearRange(description: string): { start: string; end: string } | undefined {
    if (/90s|nineties|1990s|1990/.test(description)) {
      return { start: '1990-01-01', end: '1999-12-31' };
    }

    if (/80s|eighties|1980s|1980/.test(description)) {
      return { start: '1980-01-01', end: '1989-12-31' };
    }

    return undefined;
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
