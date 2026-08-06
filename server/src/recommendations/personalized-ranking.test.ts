import { describe, expect, it } from 'vitest';

import { applyPersonalizedRanking } from './personalized-ranking';
import type { TasteSignals } from './taste-signals';
import type { MovieRecommendation } from '../types/recommendations';

const baseRecommendations: MovieRecommendation[] = [
  {
    tmdbMovieId: 1,
    title: 'Scary Night',
    posterUrl: '',
    releaseYear: 2020,
    runtimeMinutes: 100,
    tmdbRating: 7,
    genres: ['Horror'],
    providers: [],
    country: 'CA',
    mediaType: 'movie',
    originalLanguage: 'en',
    explanation: 'x',
  },
  {
    tmdbMovieId: 2,
    title: 'Funny Evening',
    posterUrl: '',
    releaseYear: 2021,
    runtimeMinutes: 98,
    tmdbRating: 7.2,
    genres: ['Comedy'],
    providers: [],
    country: 'CA',
    mediaType: 'movie',
    originalLanguage: 'fr',
    explanation: 'y',
  },
];

const signals: TasteSignals = {
  preferredGenres: ['Comedy'],
  avoidedGenres: ['Horror'],
  preferredLanguages: ['fr'],
  avoidedLanguages: ['en'],
  positiveCount: 4,
  negativeCount: 3,
  hasMinimumEvidence: true,
};

describe('applyPersonalizedRanking', () => {
  it('promotes safe positive matches and demotes repeated negatives', () => {
    const reranked = applyPersonalizedRanking(baseRecommendations, signals, {
      mediaType: 'movie',
      explicitLanguageFilter: undefined,
      ratedTitleKeys: new Set(['movie:1']),
    });

    expect(reranked[0].tmdbMovieId).toBe(2);
  });

  it('does not apply when minimum evidence is not met', () => {
    const reranked = applyPersonalizedRanking(baseRecommendations, {
      ...signals,
      hasMinimumEvidence: false,
    }, {
      mediaType: 'movie',
      explicitLanguageFilter: undefined,
      ratedTitleKeys: new Set(),
    });

    expect(reranked.map((item) => item.tmdbMovieId)).toEqual([1, 2]);
  });

  it('ignores learned language preferences when explicit language filter is present', () => {
    const reranked = applyPersonalizedRanking(baseRecommendations, {
      ...signals,
      preferredGenres: [],
      avoidedGenres: [],
    }, {
      mediaType: 'movie',
      explicitLanguageFilter: ['en'],
      ratedTitleKeys: new Set(),
    });

    expect(reranked.map((item) => item.tmdbMovieId)).toEqual([1, 2]);
  });

  it('is deterministic for the same input', () => {
    const one = applyPersonalizedRanking(baseRecommendations, signals, {
      mediaType: 'movie',
      explicitLanguageFilter: undefined,
      ratedTitleKeys: new Set(['movie:1']),
    });
    const two = applyPersonalizedRanking(baseRecommendations, signals, {
      mediaType: 'movie',
      explicitLanguageFilter: undefined,
      ratedTitleKeys: new Set(['movie:1']),
    });

    expect(one.map((item) => item.tmdbMovieId)).toEqual(two.map((item) => item.tmdbMovieId));
  });
});
