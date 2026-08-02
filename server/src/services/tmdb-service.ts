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

interface TmdbKeywordSearchResponse {
  results?: Array<{ id: number; name: string }>;
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
    const mediaType = request.mediaType ?? 'movie';
    console.log(`[TMDB] Request: ${request.description} (type: ${mediaType})`);

    // Phase 1: ask OpenAI to interpret the description into concrete search terms.
    const interpretation = this.openAiService
      ? await this.openAiService.interpretRequest(request)
      : null;
    console.log('[TMDB] OpenAI interpretation:', JSON.stringify(interpretation));

    const allResults = new Map<number, TmdbDiscoverMovieResult>();

    const addResults = (items: TmdbDiscoverMovieResult[], source: string) => {
      console.log(`[TMDB] Adding ${items.length} results from ${source}`);
      for (const item of items) {
        if (!allResults.has(item.id)) allResults.set(item.id, item);
      }
      console.log(`[TMDB] Total unique results so far: ${allResults.size}`);
    };

    // Phase 2a: search TMDB by specific title queries from OpenAI.
    if (interpretation?.searchQueries?.length) {
      console.log(`[TMDB] Searching for titles: ${interpretation.searchQueries.join(', ')}`);
      await Promise.all(
        interpretation.searchQueries.map(async (query) => {
          const results = await this.searchByTitle(query, mediaType);
          console.log(`[TMDB] Title search for "${query}" returned ${results.length} results`);
          addResults(results, `title-search[${query}]`);
        }),
      );
    }

    // Phase 2b: find TMDB keyword IDs, then discover by keyword.
    if (interpretation?.keywords?.length) {
      console.log(`[TMDB] Resolving keywords: ${interpretation.keywords.join(', ')}`);
      const keywordIds = (
        await Promise.all(
          interpretation.keywords.map(async (kw) => {
            const id = await this.resolveKeywordId(kw);
            console.log(`[TMDB] Keyword "${kw}" resolved to ID: ${id}`);
            return id;
          }),
        )
      ).filter((id): id is number => id !== null);

      if (keywordIds.length) {
        console.log(`[TMDB] Discovering by keywords: ${keywordIds.join(', ')}`);
        const kwParams = this.buildDiscoverParams(request, {
          genreIds: interpretation.genreIds,
          yearRange: interpretation.yearRange,
        });
        kwParams.set('with_keywords', keywordIds.join('|'));
        kwParams.delete('sort_by');
        kwParams.set('sort_by', 'vote_average.desc');
        kwParams.set('vote_count.gte', '20');
        const kwResults = await this.requestJson<TmdbDiscoverResponse>(
          `${this.config.baseUrl}/discover/${mediaType}`,
          kwParams,
        );
        addResults(kwResults.results ?? [], `keyword-discover[${keywordIds.join(',')}]`);
      } else {
        console.log('[TMDB] No keywords resolved, skipping keyword discover');
      }
    }

    // Phase 2c: broad discover using genre/year/filters as a fallback pool.
    console.log('[TMDB] Running broad discover as fallback');
    const discoverParams = this.buildDiscoverParams(request, {
      genreIds: interpretation?.genreIds,
      yearRange: interpretation?.yearRange,
    });
    console.log('[TMDB] Discover params:', Object.fromEntries(discoverParams));
    const discoverResults = await this.requestJson<TmdbDiscoverResponse>(
      `${this.config.baseUrl}/discover/${mediaType}`,
      discoverParams,
    );
    addResults(discoverResults.results ?? [], 'broad-discover');

    // Filter excluded IDs and enrich up to 15 candidates.
    const candidates = [...allResults.values()].filter(
      (r) => !request.excludedMovieIds?.includes(r.id),
    );
    console.log(`[TMDB] Enriching ${Math.min(candidates.length, 15)} of ${candidates.length} candidates`);
    const enriched = await this.enrichCandidates(candidates.slice(0, 15), request);
    console.log(`[TMDB] Enriched candidates:`, enriched.map((c) => ({ id: c.tmdbMovieId, title: c.title })));

    // Phase 3: OpenAI ranks and filters the merged pool.
    const recommendations = this.openAiService
      ? await this.openAiService.rankCandidates(request, enriched)
      : enriched.slice(0, 5).map((c) => ({
          ...c,
          explanation: this.buildTemporaryExplanation(c, request),
        }));
    console.log('[TMDB] Final recommendations:', recommendations.map((r) => ({ id: r.tmdbMovieId, title: r.title, explanation: r.explanation })));

    return { recommendations, source: 'live' };
  }

  private async searchByTitle(
    query: string,
    mediaType: 'movie' | 'tv',
  ): Promise<TmdbDiscoverMovieResult[]> {
    try {
      const response = await this.requestJson<TmdbDiscoverResponse>(
        `${this.config.baseUrl}/search/${mediaType}`,
        new URLSearchParams({ query, language: 'en-US', page: '1' }),
      );
      const results = (response.results ?? []).slice(0, 5);
      console.log(`[TMDB] searchByTitle("${query}"): ${results.length} results`);
      return results;
    } catch (error) {
      console.error(`[TMDB] searchByTitle("${query}") failed:`, error);
      return [];
    }
  }

  private async resolveKeywordId(keyword: string): Promise<number | null> {
    try {
      const response = await this.requestJson<TmdbKeywordSearchResponse>(
        `${this.config.baseUrl}/search/keyword`,
        new URLSearchParams({ query: keyword }),
      );
      const id = response.results?.[0]?.id ?? null;
      console.log(`[TMDB] resolveKeywordId("${keyword}"): ${id}`);
      return id;
    } catch (error) {
      console.error(`[TMDB] resolveKeywordId("${keyword}") failed:`, error);
      return null;
    }
  }

  private buildDiscoverParams(
    request: RecommendationRequest,
    overrides?: { genreIds?: number[]; yearRange?: { start: string; end: string } | null },
  ): URLSearchParams {
    const params = new URLSearchParams({
      include_adult: 'false',
      include_video: 'false',
      language: 'en-US',
      sort_by: 'popularity.desc',
      page: '1',
    });

    const genreIds = overrides?.genreIds?.length
      ? overrides.genreIds.map(String)
      : [];
    if (genreIds.length) {
      params.set('with_genres', genreIds.join('|'));
    }

    const yearRange = overrides?.yearRange ?? this.extractYearRange(request.description ?? '');
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

    return params;
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
    return parts.join(' ');
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

