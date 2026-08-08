import { describe, expect, it } from 'vitest';

import { BASELINE_CONFIGURATION, parseNumberList, parsePriorities, parseTitleControls, validateGuidance } from './guidance-helpers';

describe('guidance helpers', () => {
  it('parses bounded structured list controls', () => {
    expect(parseNumberList('8, 9, 8, nope')).toEqual([8, 9]);
    expect(parsePriorities('8:2, 9:-1, bad:9', true)).toEqual([{ id: 8, position: 2 }, { id: 9, position: -1 }]);
    expect(parseTitleControls('movie:12, tv:34, book:5')).toEqual([{ mediaType: 'movie', tmdbId: 12 }, { mediaType: 'tv', tmdbId: 34 }]);
  });

  it('validates cross-field rules and campaign times', () => {
    const configuration = structuredClone(BASELINE_CONFIGURATION);
    configuration.rules.hard.earliestReleaseYear = 2025;
    configuration.rules.hard.latestReleaseYear = 2020;
    expect(validateGuidance(configuration)['rules.hard.latestReleaseYear']).toBeTruthy();
  });
});