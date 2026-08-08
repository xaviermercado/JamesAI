import { describe, expect, it, vi } from 'vitest';

import { ProductAnalyticsRepository } from './product-analytics-repository';
import type { ValidatedProductAnalyticsEvent } from './product-analytics';

const EVENT: ValidatedProductAnalyticsEvent = {
  eventId: 'event-id',
  recommendationCorrelationId: '0f891af5-800c-4c39-b26e-494b2d950fcc',
  eventName: 'recommendation_saved',
  occurredAt: new Date('2026-08-07T12:34:00.000Z'),
  configurationVersionId: null,
  resultCountBucket: 'none',
  responseStatus: 'none',
  responseTimeBucket: 'none',
  mediaType: 'none',
  genreFilterCount: 0,
  providerFilterCount: 0,
  languageFilterCount: 0,
  authenticated: true,
  failureCategory: 'none',
  feedbackCategory: 'none',
  sourceSurface: 'library',
};

describe('ProductAnalyticsRepository', () => {
  it('inherits a correlated recommendation configuration without accepting a client version', async () => {
    const query = vi.fn(async (_sql: string, _parameters?: unknown[]) => [{}]);
    const repository = new ProductAnalyticsRepository({ query } as never);

    await repository.insertEvent(EVENT);

    const [sql, parameters = []] = query.mock.calls[0];
    expect(sql).toContain('inherited.recommendation_correlation_id = ?');
    expect(parameters[4]).toBeNull();
    expect(parameters[5]).toBe(EVENT.recommendationCorrelationId);
  });

  it('groups the derived helpful-request metric by configuration version', async () => {
    const connection = {
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn(),
      query: vi.fn(async (_sql: string, _parameters?: unknown[]) => [{}]),
    };
    const repository = new ProductAnalyticsRepository({ getConnection: vi.fn(async () => connection) } as never);

    await repository.aggregateUtcDay(new Date('2026-08-07T00:00:00Z'), new Date('2026-08-08T00:00:00Z'));

    const helpfulQuery = connection.query.mock.calls.find(([sql]) => String(sql).includes("'helpful_recommendation_request'"));
    expect(helpfulQuery?.[0]).toContain("GROUP BY COALESCE(configuration_version_id, '')");
  });
});