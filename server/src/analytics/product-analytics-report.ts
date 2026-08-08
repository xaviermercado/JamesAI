import type { ProductAnalyticsDailyRow } from './product-analytics';

export interface ProductAnalyticsReport {
  recommendationRequests: number;
  successfulRecommendations: { numerator: number; denominator: number; rate: number };
  emptyResults: { numerator: number; denominator: number; rate: number };
  recommendationFailures: { numerator: number; denominator: number; rate: number; byCategory: Record<string, number> };
  recommendationOpens: { numerator: number; denominator: number; rate: number };
  saves: { numerator: number; denominator: number; rate: number };
  feedback: { positive: number; negative: number; alreadyWatched: number; positiveRate: number; negativeRate: number };
  helpfulRecommendations: { numerator: number; denominator: number; rate: number };
  responseTimeBuckets: Record<string, number>;
  medianResponseTimeBucket: string | null;
  p95ResponseTimeBucket: string | null;
  letterboxdSync: { succeeded: number; failed: number };
  registrations: number;
  verificationEmail: { succeeded: number; failed: number };
  contactSubmissions: { succeeded: number; failed: number };
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function sum(rows: ProductAnalyticsDailyRow[], predicate: (row: ProductAnalyticsDailyRow) => boolean, correlated = false): number {
  return rows.filter(predicate).reduce((total, row) => total + (correlated ? row.correlatedRequestCount : row.eventCount), 0);
}

function percentileBucket(buckets: Record<string, number>, percentile: number): string | null {
  const order = ['under_1s', '1_3s', '3_10s', 'over_10s'];
  const total = order.reduce((value, bucket) => value + (buckets[bucket] ?? 0), 0);
  if (total === 0) return null;
  const target = Math.ceil(total * percentile);
  let cumulative = 0;
  for (const bucket of order) {
    cumulative += buckets[bucket] ?? 0;
    if (cumulative >= target) return bucket;
  }
  return order.at(-1) ?? null;
}

export function buildProductAnalyticsReport(rows: ProductAnalyticsDailyRow[]): ProductAnalyticsReport {
  const recommendationRequests = sum(rows, (row) => row.eventName === 'recommendation_requested');
  const completed = sum(rows, (row) => row.eventName === 'recommendation_completed');
  const successful = sum(rows, (row) => row.eventName === 'recommendation_completed' && row.responseStatus === 'success');
  const empty = sum(rows, (row) => row.eventName === 'recommendation_completed' && row.responseStatus === 'empty');
  const failures = sum(rows, (row) => row.eventName === 'recommendation_failed');
  const opens = sum(rows, (row) => row.eventName === 'recommendation_opened', true);
  const saves = sum(rows, (row) => row.eventName === 'recommendation_saved', true);
  const positive = sum(rows, (row) => row.eventName === 'recommendation_feedback' && row.feedbackCategory === 'positive');
  const negative = sum(rows, (row) => row.eventName === 'recommendation_feedback' && row.feedbackCategory === 'negative');
  const alreadyWatched = sum(rows, (row) => row.eventName === 'recommendation_feedback' && row.feedbackCategory === 'already_watched');
  const feedbackTotal = positive + negative + alreadyWatched;
  const helpful = sum(rows, (row) => row.eventName === 'helpful_recommendation_request', true);
  const responseTimeBuckets: Record<string, number> = {};
  const failuresByCategory: Record<string, number> = {};

  for (const row of rows) {
    if (row.eventName === 'recommendation_completed' && row.responseTimeBucket !== 'none') {
      responseTimeBuckets[row.responseTimeBucket] = (responseTimeBuckets[row.responseTimeBucket] ?? 0) + row.eventCount;
    }
    if (row.eventName === 'recommendation_failed' && row.failureCategory !== 'none') {
      failuresByCategory[row.failureCategory] = (failuresByCategory[row.failureCategory] ?? 0) + row.eventCount;
    }
  }

  return {
    recommendationRequests,
    successfulRecommendations: { numerator: successful, denominator: completed, rate: rate(successful, completed) },
    emptyResults: { numerator: empty, denominator: completed, rate: rate(empty, completed) },
    recommendationFailures: { numerator: failures, denominator: recommendationRequests, rate: rate(failures, recommendationRequests), byCategory: failuresByCategory },
    recommendationOpens: { numerator: opens, denominator: completed, rate: rate(opens, completed) },
    saves: { numerator: saves, denominator: completed, rate: rate(saves, completed) },
    feedback: { positive, negative, alreadyWatched, positiveRate: rate(positive, feedbackTotal), negativeRate: rate(negative, feedbackTotal) },
    helpfulRecommendations: { numerator: helpful, denominator: completed, rate: rate(helpful, completed) },
    responseTimeBuckets,
    medianResponseTimeBucket: percentileBucket(responseTimeBuckets, 0.5),
    p95ResponseTimeBucket: percentileBucket(responseTimeBuckets, 0.95),
    letterboxdSync: {
      succeeded: sum(rows, (row) => row.eventName === 'letterboxd_sync_completed'),
      failed: sum(rows, (row) => row.eventName === 'letterboxd_sync_failed'),
    },
    registrations: sum(rows, (row) => row.eventName === 'registration_completed'),
    verificationEmail: {
      succeeded: sum(rows, (row) => row.eventName === 'verification_email_succeeded'),
      failed: sum(rows, (row) => row.eventName === 'verification_email_failed'),
    },
    contactSubmissions: {
      succeeded: sum(rows, (row) => row.eventName === 'contact_submission_succeeded'),
      failed: sum(rows, (row) => row.eventName === 'contact_submission_failed'),
    },
  };
}
