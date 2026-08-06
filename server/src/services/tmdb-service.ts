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
  original_language?: string;
}

interface TmdbWatchProviderResponse {
  results?: Record<string, {
    flatrate?: Array<{ provider_id?: number; provider_name?: string }>;
    free?: Array<{ provider_id?: number; provider_name?: string }>;
    ads?: Array<{ provider_id?: number; provider_name?: string }>;
    rent?: Array<{ provider_id?: number; provider_name?: string }>;
    buy?: Array<{ provider_id?: number; provider_name?: string }>;
  }>;
}

interface TmdbDiscoverResponse {
  results?: TmdbDiscoverMovieResult[];
  total_results?: number;
}

interface TmdbKeywordSearchResponse {
  results?: Array<{ id: number; name: string }>;
}

// Map for backward compatibility with legacy name-based streamingServices.
const providerNameToIdMap: Record<string, string> = {
  netflix: '8',
  'prime video': '9',
  'amazon prime': '9',
  'apple tv+': '2',
  'apple tv': '2',
  disney: '337',
  'disney+': '337',
  max: '1899',
  hbo: '1899',
  paramount: '531',
  'paramount+': '531',
  hulu: '15',
  peacock: '386',
  mubi: '1773',
  shudder: '167',
  stan: '39',
  crave: '230',
};

export class TmdbService {
  constructor(
    private readonly config: TmdbConfig,
    private readonly openAiService?: OpenAiService,
  ) {}

  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    const mediaType = request.mediaType ?? 'movie';
    console.log(`[TMDB] Request: ${request.description} (type: ${mediaType})`);

    // Phase 1: OpenAI interprets the description into concrete search terms.
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

    // Phase 2a: title searches.
    if (interpretation?.searchQueries?.length) {
      await Promise.all(
        interpretation.searchQueries.map(async (query) => {
          const results = await this.searchByTitle(query, mediaType);
          addResults(results, `title-search[${query}]`);
        }),
      );
    }

    // Phase 2b: keyword-based discovery (includes provider + language + market filters).
    if (interpretation?.keywords?.length) {
      const keywordIds = (
        await Promise.all(interpretation.keywords.map(async (kw) => this.resolveKeywordId(kw)))
      ).filter((id): id is number => id !== null);

      if (keywordIds.length) {
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
        addResults(kwResults.results ?? [], `keyword-discover`);
      }
    }

    // Phase 2c: broad discover with all effective constraints applied.
    const discoverParams = this.buildDiscoverParams(request, {
      genreIds: interpretation?.genreIds,
      yearRange: interpretation?.yearRange,
    });
    const discoverResults = await this.requestJson<TmdbDiscoverResponse>(
      `${this.config.baseUrl}/discover/${mediaType}`,
      discoverParams,
    );
    addResults(discoverResults.results ?? [], 'broad-discover');

    // Phase 2d: if language-filtered discover returns too few candidates, run a relaxed discover.
    const hasLanguageFilter = Boolean(request.originalLanguages?.length);
    const hasProviderFilter = Boolean(request.providerIds?.length || request.streamingServices?.length);
    if (allResults.size < 5 && (hasLanguageFilter || hasProviderFilter)) {
      console.log('[TMDB] Too few results with constraints; running relaxed discover');
      const relaxedParams = this.buildDiscoverParams(
        { ...request, providerIds: undefined, streamingServices: undefined, originalLanguages: undefined },
        { genreIds: interpretation?.genreIds, yearRange: interpretation?.yearRange },
      );
      const relaxedResults = await this.requestJson<TmdbDiscoverResponse>(
        `${this.config.baseUrl}/discover/${mediaType}`,
        relaxedParams,
      );
      addResults(relaxedResults.results ?? [], 'relaxed-discover');
    }

    // Filter excluded IDs and enrich up to 15 candidates.
    const candidates = [...allResults.values()].filter(
      (r) => !request.excludedMovieIds?.includes(r.id),
    );
    console.log(`[TMDB] Enriching ${Math.min(candidates.length, 15)} of ${candidates.length} candidates`);
    const enriched = await this.enrichCandidates(candidates.slice(0, 15), request);

    // Phase 3: OpenAI ranks and generates explanations.
    const recommendations = this.openAiService
      ? await this.openAiService.rankCandidates(request, enriched)
      : enriched.slice(0, 5).map((c) => ({
          ...c,
          explanation: this.buildFallbackExplanation(c, request),
        }));

    console.log('[TMDB] Final recommendations:', recommendations.map((r) => ({ id: r.tmdbMovieId, title: r.title })));

    return {
      recommendations,
      source: 'live',
      // preferencesApplied is set by the route handler which has auth context.
      preferencesApplied: false,
    };
  }

  private async searchByTitle(query: string, mediaType: 'movie' | 'tv'): Promise<TmdbDiscoverMovieResult[]> {
    try {
      const response = await this.requestJson<TmdbDiscoverResponse>(
        `${this.config.baseUrl}/search/${mediaType}`,
        new URLSearchParams({ query, language: 'en-US', page: '1' }),
      );
      return (response.results ?? []).slice(0, 5);
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
      return response.results?.[0]?.id ?? null;
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

    const genreIds = overrides?.genreIds?.length ? overrides.genreIds.map(String) : [];
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

    const market = request.country;
    if (market) {
      params.set('watch_region', market);
    }

    // Provider filtering: prefer numeric IDs over legacy name-based lookup.
    if (request.providerIds?.length) {
      params.set('with_watch_providers', request.providerIds.join('|'));
    } else if (request.streamingServices?.length) {
      const ids = request.streamingServices
        .map((name) => providerNameToIdMap[name.toLowerCase()])
        .filter(Boolean);
      if (ids.length) {
        params.set('with_watch_providers', ids.join('|'));
      }
    }

    // Language filtering: use primary language for discover; remaining languages handled in ranking.
    // TMDB /discover only reliably supports one language code per request.
    if (request.originalLanguages?.length) {
      params.set('with_original_language', request.originalLanguages[0]);
    }

    return params;
  }

  private extractYearRange(description: string): { start: string; end: string } | undefined {
    if (/90s|nineties|1990s|1990/.test(description)) return { start: '1990-01-01', end: '1999-12-31' };
    if (/80s|eighties|1980s|1980/.test(description)) return { start: '1980-01-01', end: '1989-12-31' };
    return undefined;
  }

  private async enrichCandidates(
    candidates: TmdbDiscoverMovieResult[],
    request: RecommendationRequest,
  ): Promise<MovieCandidate[]> {
    const results: MovieCandidate[] = [];

    for (const candidate of candidates) {
      try {
        const details = await this.requestJson<TmdbMovieDetailsResult>(
          `${this.config.baseUrl}/${request.mediaType ?? 'movie'}/${candidate.id}`,
          { language: 'en-US' },
        );

        const providers = await this.getWatchProviders(candidate.id, request.mediaType ?? 'movie', request.country);
        const title = details.title ?? details.name ?? candidate.title ?? candidate.name ?? 'Untitled';
        const releaseDate = details.release_date ?? details.first_air_date ?? '';
        const releaseYear = releaseDate ? Number(releaseDate.slice(0, 4)) : 0;
        const runtime = details.runtime ?? details.episode_run_time?.[0] ?? 0;
        const genres = (details.genres ?? []).map((g) => g.name);
        const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '';

        results.push({
          tmdbMovieId: candidate.id,
          title,
          posterUrl,
          releaseYear,
          runtimeMinutes: runtime,
          tmdbRating: details.vote_average ?? 0,
          genres,
          providers,
          country: request.country ?? '',
          mediaType: request.mediaType ?? 'movie',
          originalLanguage: details.original_language?.toLowerCase(),
        });
      } catch (error) {
        console.error(`[TMDB] enrichCandidates failed for id ${candidate.id}:`, error);
      }
    }

    return results;
  }

  async getMovieProviders(movieId: number, mediaType: 'movie' | 'tv', country?: string): Promise<string[]> {
    return this.getWatchProviders(movieId, mediaType, country);
  }

  async getTitleSummary(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<MovieCandidate | null> {
    try {
      const details = await this.requestJson<TmdbMovieDetailsResult>(
        `${this.config.baseUrl}/${mediaType}/${tmdbId}`,
        { language: 'en-US' },
      );

      const title = details.title ?? details.name ?? `Title #${tmdbId}`;
      const releaseDate = details.release_date ?? details.first_air_date ?? '';
      const releaseYear = releaseDate ? Number(releaseDate.slice(0, 4)) : 0;
      const runtime = details.runtime ?? details.episode_run_time?.[0] ?? 0;
      const genres = (details.genres ?? []).map((g) => g.name);
      const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '';

      return {
        tmdbMovieId: tmdbId,
        title,
        posterUrl,
        releaseYear,
        runtimeMinutes: runtime,
        tmdbRating: details.vote_average ?? 0,
        genres,
        providers: [],
        country: '',
        mediaType,
        originalLanguage: details.original_language?.toLowerCase(),
      };
    } catch (error) {
      console.error(`[TMDB] getTitleSummary failed for ${mediaType}:${tmdbId}:`, error);
      return null;
    }
  }

  async getTitleSummaries(
    titles: Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>,
  ): Promise<MovieCandidate[]> {
    const capped = titles.slice(0, 100);
    const summaries = await Promise.all(
      capped.map(async (title) => this.getTitleSummary(title.tmdbId, title.mediaType)),
    );

    return summaries.filter((item): item is MovieCandidate => item !== null);
  }

  private async getWatchProviders(id: number, mediaType: 'movie' | 'tv', country?: string): Promise<string[]> {
    try {
      const url = `${this.config.baseUrl}/${mediaType}/${id}/watch/providers`;
      const response = await this.requestJson<TmdbWatchProviderResponse>(url, {});
      const region = country?.toUpperCase();
      const regionData = region ? response.results?.[region] : undefined;
      // Return only subscription (flatrate) providers to avoid conflating rental/purchase.
      const flatrate = regionData?.flatrate ?? [];
      return flatrate.map((p) => p.provider_name ?? 'Unknown').filter(Boolean);
    } catch (error) {
      console.error(`[TMDB] getWatchProviders failed for id ${id}:`, error);
      return [];
    }
  }

  private buildFallbackExplanation(candidate: MovieCandidate, request: RecommendationRequest): string {
    const parts: string[] = [`A ${request.mediaType ?? 'movie'} result from TMDB.`];
    if (request.maxRuntime) parts.push(`Under ${request.maxRuntime} minutes.`);
    if (candidate.providers.length > 0) parts.push(`Available on ${candidate.providers[0]}.`);
    return parts.join(' ');
  }

  private async requestJson<T>(url: string, params: Record<string, string> | URLSearchParams): Promise<T> {
    const searchParams = params instanceof URLSearchParams ? params : new URLSearchParams(params);
    const target = new URL(url);
    target.search = searchParams.toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(target.toString(), {
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error('TMDB rate limit exceeded');
        if (response.status >= 500) throw new Error('TMDB service unavailable');
        throw new Error(`TMDB request failed with status ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('TMDB request timed out');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
