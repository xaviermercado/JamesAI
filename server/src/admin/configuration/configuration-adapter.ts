import type { JamesConfiguration } from './configuration-schema';

type PriorityEntry<T> = { id: T; position: number };

export interface ConfigurationAdapterOutput {
  schemaVersion: 1;
  filters: {
    mediaTypes: Array<'movie' | 'tv'>;
    providerIds: number[];
    genreIds: number[];
    languageCodes: string[];
    minimumRating: number | null;
    maximumRuntimeMinutes: number | null;
    releaseYear: { minimum: number | null; maximum: number | null };
    includedTitleKeys: string[];
    excludedTitleKeys: string[];
  };
  ranking: {
    axes: JamesConfiguration['priorityAxes'];
    providerPriorities: Array<PriorityEntry<number>>;
    genrePriorities: Array<PriorityEntry<number>>;
    languagePriorities: Array<PriorityEntry<string>>;
    softTargets: JamesConfiguration['rules']['soft'];
    activeCampaigns: Array<{
      campaignId: string;
      priorityBoost: number;
      providerIds: number[];
      genreIds: number[];
      languageCodes: string[];
      titleKeys: string[];
    }>;
  };
  editorialContext: { philosophy: string | null; notes: string[]; campaignNotes: string[] };
  precedence: readonly ['request-hard-constraints', 'configuration-hard-rules', 'title-controls', 'active-campaigns', 'configuration-soft-rules', 'existing-ranking'];
}

function titleKey(title: { mediaType: 'movie' | 'tv'; tmdbId: number }): string {
  return `${title.mediaType}:${title.tmdbId}`;
}

function sortedPriorities<T extends number | string>(entries: Array<PriorityEntry<T>>): Array<PriorityEntry<T>> {
  return [...entries].sort((left, right) => String(left.id).localeCompare(String(right.id), 'en', { numeric: true }));
}

export function adaptConfiguration(configuration: JamesConfiguration, now = new Date()): ConfigurationAdapterOutput {
  const nowMs = now.getTime();
  const activeCampaigns = configuration.campaigns
    .filter((campaign) => Date.parse(campaign.startsAt) <= nowMs && nowMs < Date.parse(campaign.endsAt))
    .sort((left, right) => left.campaignId.localeCompare(right.campaignId));

  return {
    schemaVersion: 1,
    filters: {
      mediaTypes: [...configuration.rules.hard.mediaTypes].sort(),
      providerIds: [...configuration.rules.hard.providerIds].sort((a, b) => a - b),
      genreIds: [...configuration.rules.hard.genreIds].sort((a, b) => a - b),
      languageCodes: [...configuration.rules.hard.languageCodes].sort(),
      minimumRating: configuration.rules.hard.minimumRating,
      maximumRuntimeMinutes: configuration.rules.hard.maximumRuntimeMinutes,
      releaseYear: { minimum: configuration.rules.hard.earliestReleaseYear, maximum: configuration.rules.hard.latestReleaseYear },
      includedTitleKeys: configuration.titleControls.include.map(titleKey).sort(),
      excludedTitleKeys: configuration.titleControls.exclude.map(titleKey).sort(),
    },
    ranking: {
      axes: { ...configuration.priorityAxes },
      providerPriorities: sortedPriorities(configuration.contentPriorities.providers),
      genrePriorities: sortedPriorities(configuration.contentPriorities.genres),
      languagePriorities: sortedPriorities(configuration.contentPriorities.languages),
      softTargets: { ...configuration.rules.soft },
      activeCampaigns: activeCampaigns.map((campaign) => ({
        campaignId: campaign.campaignId,
        priorityBoost: campaign.priorityBoost,
        providerIds: [...campaign.providerIds].sort((a, b) => a - b),
        genreIds: [...campaign.genreIds].sort((a, b) => a - b),
        languageCodes: [...campaign.languageCodes].sort(),
        titleKeys: campaign.titleIds.map(titleKey).sort(),
      })),
    },
    editorialContext: {
      philosophy: configuration.philosophy.statement,
      notes: [...configuration.philosophy.editorialNotes],
      campaignNotes: activeCampaigns.flatMap((campaign) => campaign.editorialNote ? [campaign.editorialNote] : []),
    },
    precedence: ['request-hard-constraints', 'configuration-hard-rules', 'title-controls', 'active-campaigns', 'configuration-soft-rules', 'existing-ranking'],
  };
}
