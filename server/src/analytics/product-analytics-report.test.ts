import { describe, expect, it } from 'vitest';

import { buildProductAnalyticsReport } from './product-analytics-report';
import type { ProductAnalyticsDailyRow } from './product-analytics';

function row(overrides: Partial<ProductAnalyticsDailyRow>): ProductAnalyticsDailyRow {
  return {
    aggregateDate: '2026-08-07', eventName: 'recommendation_requested', configurationVersionId: null,
    resultCountBucket: 'none', responseStatus: 'none', responseTimeBucket: 'none', mediaType: 'none',
    failureCategory: 'none', feedbackCategory: 'none', sourceSurface: 'none', authenticated: false,
    eventCount: 0, correlatedRequestCount: 0, ...overrides,
  };
}

describe('buildProductAnalyticsReport', () => {
  it('uses documented numerators, denominators, and bucket percentiles', () => {
    const report = buildProductAnalyticsReport([
      row({ eventName: 'recommendation_requested', eventCount: 10 }),
      row({ eventName: 'recommendation_completed', responseStatus: 'success', responseTimeBucket: 'under_1s', eventCount: 6 }),
      row({ eventName: 'recommendation_completed', responseStatus: 'empty', responseTimeBucket: '3_10s', eventCount: 2 }),
      row({ eventName: 'recommendation_failed', failureCategory: 'timeout', eventCount: 2 }),
      row({ eventName: 'recommendation_saved', correlatedRequestCount: 3, eventCount: 3 }),
      row({ eventName: 'recommendation_feedback', feedbackCategory: 'positive', eventCount: 2 }),
      row({ eventName: 'recommendation_feedback', feedbackCategory: 'negative', eventCount: 1 }),
      row({ eventName: 'helpful_recommendation_request', correlatedRequestCount: 4, eventCount: 4 }),
    ]);
    expect(report.successfulRecommendations).toEqual({ numerator: 6, denominator: 8, rate: 0.75 });
    expect(report.emptyResults).toEqual({ numerator: 2, denominator: 8, rate: 0.25 });
    expect(report.recommendationFailures).toMatchObject({ numerator: 2, denominator: 10, rate: 0.2, byCategory: { timeout: 2 } });
    expect(report.saves).toEqual({ numerator: 3, denominator: 8, rate: 0.375 });
    expect(report.helpfulRecommendations).toEqual({ numerator: 4, denominator: 8, rate: 0.5 });
    expect(report.medianResponseTimeBucket).toBe('under_1s');
    expect(report.p95ResponseTimeBucket).toBe('3_10s');
  });

  it('returns zero rates and null percentile buckets with no data', () => {
    const report = buildProductAnalyticsReport([]);
    expect(report.successfulRecommendations).toEqual({ numerator: 0, denominator: 0, rate: 0 });
    expect(report.helpfulRecommendations.rate).toBe(0);
    expect(report.medianResponseTimeBucket).toBeNull();
    expect(report.p95ResponseTimeBucket).toBeNull();
  });
});
