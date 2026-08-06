import type { MovieRecommendation } from '../types/recommendations';
import type { TasteSignals } from './taste-signals';

export const PERSONALIZATION_ALGORITHM_VERSION = 'm5-v1';

const MAX_TOTAL_ADJUSTMENT = 0.35;
const GENRE_ADJUSTMENT = 0.12;
const LANGUAGE_ADJUSTMENT = 0.08;
const RATED_TITLE_PENALTY = 0.12;

export interface RankingContext {
  mediaType: 'movie' | 'tv';
  explicitLanguageFilter?: string[];
  ratedTitleKeys: Set<string>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toTitleKey(tmdbId: number, mediaType: 'movie' | 'tv'): string {
  return `${mediaType}:${tmdbId}`;
}

function signalConfidence(signals: TasteSignals): number {
  const total = signals.positiveCount + signals.negativeCount;
  if (total < 2) return 0;

  const evidenceFactor = clamp(total / 6, 0.35, 1);
  const balance = total === 0 ? 0 : Math.abs(signals.positiveCount - signals.negativeCount) / total;
  const consistencyFactor = 0.5 + balance * 0.5;

  return evidenceFactor * consistencyFactor;
}

function computeAdjustment(
  recommendation: MovieRecommendation,
  signals: TasteSignals,
  context: RankingContext,
): number {
  const preferredGenres = new Set(signals.preferredGenres.map((g) => g.toLowerCase()));
  const avoidedGenres = new Set(signals.avoidedGenres.map((g) => g.toLowerCase()));
  const preferredLanguages = new Set(signals.preferredLanguages.map((l) => l.toLowerCase()));
  const avoidedLanguages = new Set(signals.avoidedLanguages.map((l) => l.toLowerCase()));

  let adjustment = 0;

  const genres = recommendation.genres.map((g) => g.toLowerCase());
  const preferredGenreMatches = genres.filter((g) => preferredGenres.has(g)).length;
  const avoidedGenreMatches = genres.filter((g) => avoidedGenres.has(g)).length;

  adjustment += Math.min(preferredGenreMatches, 2) * GENRE_ADJUSTMENT;
  adjustment -= Math.min(avoidedGenreMatches, 2) * GENRE_ADJUSTMENT;

  if (!context.explicitLanguageFilter?.length && recommendation.originalLanguage) {
    const language = recommendation.originalLanguage.toLowerCase();
    if (preferredLanguages.has(language)) adjustment += LANGUAGE_ADJUSTMENT;
    if (avoidedLanguages.has(language)) adjustment -= LANGUAGE_ADJUSTMENT;
  }

  if (context.ratedTitleKeys.has(toTitleKey(recommendation.tmdbMovieId, recommendation.mediaType))) {
    adjustment -= RATED_TITLE_PENALTY;
  }

  return clamp(adjustment, -MAX_TOTAL_ADJUSTMENT, MAX_TOTAL_ADJUSTMENT);
}

export function applyPersonalizedRanking(
  recommendations: MovieRecommendation[],
  signals: TasteSignals,
  context: RankingContext,
): MovieRecommendation[] {
  if (!signals.hasMinimumEvidence || recommendations.length <= 1) {
    return recommendations;
  }

  const confidence = signalConfidence(signals);
  if (confidence <= 0) return recommendations;

  const scored = recommendations.map((item, index) => {
    // Keep the original ranking as a prior, but leave room for bounded learned adjustments.
    const baseScore = (recommendations.length - index) / (recommendations.length * 4);
    const adjustment = computeAdjustment(item, signals, context) * confidence;
    return {
      item,
      index,
      score: baseScore + adjustment,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.map((entry) => entry.item);
}
