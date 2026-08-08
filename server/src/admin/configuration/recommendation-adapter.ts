import { streamingServiceCatalog } from '../../profile/reference-data';
import type { MovieRecommendation, RecommendationRequest } from '../../types/recommendations';
import type { ConfigurationAdapterOutput } from './configuration-adapter';

const MAX_EDITORIAL_CONTEXT_CHARACTERS = 2_000;

function providerNames(providerIds: number[]): string[] {
  return providerIds
    .map((providerId) => streamingServiceCatalog.find((provider) => provider.providerId === providerId)?.providerName)
    .filter((name): name is string => Boolean(name));
}

function titleKey(item: { mediaType: 'movie' | 'tv'; tmdbMovieId: number }): string {
  return `${item.mediaType}:${item.tmdbMovieId}`;
}

function boundedEditorialContext(adapter: ConfigurationAdapterOutput): string | undefined {
  const value = JSON.stringify({
    philosophy: adapter.editorialContext.philosophy,
    notes: adapter.editorialContext.notes,
    campaignNotes: adapter.editorialContext.campaignNotes,
  });
  if (value === '{"philosophy":null,"notes":[],"campaignNotes":[]}') return undefined;
  return value.slice(0, MAX_EDITORIAL_CONTEXT_CHARACTERS);
}

export function applyConfigurationToRequest(
  request: RecommendationRequest,
  adapter: ConfigurationAdapterOutput,
  precedence: { preserveProviders?: boolean; preserveLanguages?: boolean } = {},
): RecommendationRequest {
  const configuredRuntime = adapter.filters.maximumRuntimeMinutes;
  const excludedIds = adapter.filters.excludedTitleKeys
    .filter((key) => key.startsWith(`${request.mediaType ?? 'movie'}:`))
    .map((key) => Number(key.split(':')[1]))
    .filter(Number.isInteger);

  return {
    ...request,
    maxRuntime: configuredRuntime === null
      ? request.maxRuntime
      : Math.min(request.maxRuntime ?? configuredRuntime, configuredRuntime),
    providerIds: precedence.preserveProviders || request.providerIds?.length || request.streamingServices?.length
      ? request.providerIds
      : adapter.filters.providerIds.length > 0 ? adapter.filters.providerIds : request.providerIds,
    originalLanguages: precedence.preserveLanguages || request.originalLanguages?.length
      ? request.originalLanguages
      : adapter.filters.languageCodes.length > 0 ? adapter.filters.languageCodes : request.originalLanguages,
    excludedMovieIds: [...new Set([...(request.excludedMovieIds ?? []), ...excludedIds])],
    editorialContext: boundedEditorialContext(adapter),
  };
}

export function applyConfigurationToRecommendations<T extends MovieRecommendation>(
  recommendations: T[],
  adapter: ConfigurationAdapterOutput,
): T[] {
  const excluded = new Set(adapter.filters.excludedTitleKeys);
  const included = new Set(adapter.filters.includedTitleKeys);
  const preferredProviders = new Map(
    adapter.ranking.providerPriorities.flatMap((priority) =>
      providerNames([priority.id]).map((name) => [name.toLowerCase(), priority.position] as const)),
  );
  const preferredLanguages = new Map(adapter.ranking.languagePriorities.map((priority) => [priority.id, priority.position]));
  const activeCampaignTitles = new Map(adapter.ranking.activeCampaigns.flatMap((campaign) =>
    campaign.titleKeys.map((key) => [key, campaign.priorityBoost] as const)));

  const filtered = recommendations.filter((item) => {
    if (excluded.has(titleKey(item))) return false;
    if (adapter.filters.minimumRating !== null && item.tmdbRating < adapter.filters.minimumRating) return false;
    if (adapter.filters.maximumRuntimeMinutes !== null && item.runtimeMinutes > adapter.filters.maximumRuntimeMinutes) return false;
    if (adapter.filters.releaseYear.minimum !== null && item.releaseYear < adapter.filters.releaseYear.minimum) return false;
    if (adapter.filters.releaseYear.maximum !== null && item.releaseYear > adapter.filters.releaseYear.maximum) return false;
    if (adapter.filters.languageCodes.length > 0 && item.originalLanguage && !adapter.filters.languageCodes.includes(item.originalLanguage)) return false;
    return true;
  });

  return filtered
    .map((item, index) => {
      const key = titleKey(item);
      let score = included.has(key) ? 1_000 : 0;
      score += (activeCampaignTitles.get(key) ?? 0) * 100;
      score += item.providers.reduce((total, provider) => total + (preferredProviders.get(provider.toLowerCase()) ?? 0), 0) * 10;
      score += (preferredLanguages.get(item.originalLanguage ?? '') ?? 0) * 10;
      if (adapter.ranking.softTargets.minimumRating !== null && item.tmdbRating >= adapter.ranking.softTargets.minimumRating) score += 2;
      if (adapter.ranking.softTargets.targetRuntimeMinutes !== null) score -= Math.abs(item.runtimeMinutes - adapter.ranking.softTargets.targetRuntimeMinutes) / 600;
      if (adapter.ranking.softTargets.targetReleaseYear !== null) score -= Math.abs(item.releaseYear - adapter.ranking.softTargets.targetReleaseYear) / 200;
      return { item, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}