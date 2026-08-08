import { describe, expect, it } from 'vitest';

import type { MovieRecommendation, RecommendationRequest } from '../../types/recommendations';
import { adaptConfiguration } from './configuration-adapter';
import { createBaselineConfiguration } from './configuration-baseline';
import { applyConfigurationToRecommendations, applyConfigurationToRequest } from './recommendation-adapter';

const recommendation: MovieRecommendation = {
  tmdbMovieId: 42,
  title: 'Baseline title',
  posterUrl: '',
  releaseYear: 2024,
  runtimeMinutes: 100,
  tmdbRating: 7,
  genres: ['Drama'],
  providers: ['Netflix'],
  country: 'US',
  mediaType: 'movie',
  originalLanguage: 'en',
  explanation: 'Baseline explanation',
};

describe('recommendation configuration adapter', () => {
  it('preserves current request and result behavior for the baseline', () => {
    const adapter = adaptConfiguration(createBaselineConfiguration());
    const request: RecommendationRequest = { description: 'drama', mediaType: 'movie', excludedMovieIds: [7] };
    expect(applyConfigurationToRequest(request, adapter)).toEqual(request);
    expect(applyConfigurationToRecommendations([recommendation], adapter)).toEqual([recommendation]);
  });

  it('keeps explicit any-provider and any-language choices stronger than configuration defaults', () => {
    const configuration = createBaselineConfiguration();
    configuration.rules.hard.providerIds = [8];
    configuration.rules.hard.languageCodes = ['fr'];
    const request: RecommendationRequest = { description: 'drama', mediaType: 'movie' };
    const adapted = applyConfigurationToRequest(request, adaptConfiguration(configuration), {
      preserveProviders: true,
      preserveLanguages: true,
    });
    expect(adapted.providerIds).toBeUndefined();
    expect(adapted.originalLanguages).toBeUndefined();
  });

  it('filters and reranks deterministically without restoring excluded titles', () => {
    const configuration = createBaselineConfiguration();
    configuration.titleControls.exclude = [{ mediaType: 'movie', tmdbId: 42 }];
    configuration.contentPriorities.languages = [{ id: 'fr', position: 2 }];
    const french = { ...recommendation, tmdbMovieId: 43, title: 'French title', originalLanguage: 'fr' };
    const adapter = adaptConfiguration(configuration);
    expect(applyConfigurationToRecommendations([recommendation, french], adapter)).toEqual([french]);
    expect(applyConfigurationToRecommendations([recommendation, french], adapter)).toEqual(
      applyConfigurationToRecommendations([recommendation, french], adapter),
    );
  });
});