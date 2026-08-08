import type { JamesConfiguration } from './configuration-schema';

export const BASELINE_CONFIGURATION: JamesConfiguration = Object.freeze({
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
});

export function createBaselineConfiguration(): JamesConfiguration {
  return structuredClone(BASELINE_CONFIGURATION);
}
