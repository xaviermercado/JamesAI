import type { JamesConfiguration, PriorityItem, PriorityPosition, TitleControl } from '@/types/admin';

export const BASELINE_CONFIGURATION: JamesConfiguration = {
  schemaVersion: 1,
  philosophy: { statement: null, editorialNotes: [] },
  priorityAxes: {
    popularityVsDiscovery: 0,
    mainstreamVsNiche: 0,
    recentVsClassic: 0,
    safeVsAdventurous: 0,
    conciseVsEpic: 0,
    familiarVsDiverse: 0,
  },
  contentPriorities: { providers: [], genres: [], languages: [] },
  rules: {
    hard: {
      mediaTypes: [], providerIds: [], genreIds: [], languageCodes: [], minimumRating: null,
      maximumRuntimeMinutes: null, earliestReleaseYear: null, latestReleaseYear: null,
    },
    soft: { minimumRating: null, targetRuntimeMinutes: null, targetReleaseYear: null },
  },
  campaigns: [],
  titleControls: { include: [], exclude: [] },
};

export function parseNumberList(value: string): number[] {
  return [...new Set(value.split(',').map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0))];
}

export function parseStringList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

export function parseNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePriorities(value: string, numeric: true): PriorityItem<number>[];
export function parsePriorities(value: string, numeric: false): PriorityItem<string>[];
export function parsePriorities(value: string, numeric: boolean): PriorityItem<number | string>[] {
  return value.split(',').flatMap((item) => {
    const [rawId, rawPosition] = item.split(':').map((part) => part.trim());
    const position = Number(rawPosition);
    const id = numeric ? Number(rawId) : rawId?.toLowerCase();
    if ((!id && id !== 0) || !Number.isInteger(position) || position < -2 || position > 2) return [];
    return [{ id, position: position as PriorityPosition }];
  });
}

export function parseTitleControls(value: string): TitleControl[] {
  return value.split(',').flatMap((item) => {
    const [mediaType, rawId] = item.trim().split(':');
    const tmdbId = Number(rawId);
    if ((mediaType !== 'movie' && mediaType !== 'tv') || !Number.isInteger(tmdbId) || tmdbId <= 0) return [];
    return [{ mediaType, tmdbId }];
  });
}

export function validateGuidance(configuration: JamesConfiguration): Record<string, string> {
  const errors: Record<string, string> = {};
  const hard = configuration.rules.hard;
  if (hard.minimumRating !== null && (hard.minimumRating < 0 || hard.minimumRating > 10)) errors['rules.hard.minimumRating'] = 'Use a rating from 0 to 10.';
  if (hard.earliestReleaseYear !== null && hard.latestReleaseYear !== null && hard.earliestReleaseYear > hard.latestReleaseYear) errors['rules.hard.latestReleaseYear'] = 'Latest year must be after the earliest year.';
  configuration.campaigns.forEach((campaign, index) => {
    if (!/^[a-z][a-z0-9-]{2,39}$/.test(campaign.campaignId)) errors[`campaigns.${index}.campaignId`] = 'Use 3–40 lowercase letters, numbers, or hyphens.';
    if (!campaign.name.trim()) errors[`campaigns.${index}.name`] = 'Campaign name is required.';
    if (!Number.isFinite(Date.parse(campaign.startsAt))) errors[`campaigns.${index}.startsAt`] = 'Enter an ISO date and time with an offset.';
    if (!Number.isFinite(Date.parse(campaign.endsAt)) || Date.parse(campaign.endsAt) <= Date.parse(campaign.startsAt)) errors[`campaigns.${index}.endsAt`] = 'End must be after the campaign start.';
  });
  return errors;
}