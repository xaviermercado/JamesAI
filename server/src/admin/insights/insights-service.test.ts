import { describe, expect, it } from 'vitest';

import type { ProductAnalyticsDailyRow } from '../../analytics/product-analytics';
import { InsightsService } from './insights-service';
import type {
  AdminRole,
  AuditLogItemDto,
  CategorizeFeedbackResult,
  FeedbackInboxItemDto,
  InsightsRepositoryLike,
  PageDto,
  VersionActivationWindow,
} from './insights-types';
import type { AnalyticsQuery, AuditLogQuery, CategorizeFeedbackInput, FeedbackInboxQuery } from './insights-schemas';

function row(overrides: Partial<ProductAnalyticsDailyRow>): ProductAnalyticsDailyRow {
  return {
    aggregateDate: '2026-08-07', eventName: 'recommendation_requested', configurationVersionId: null,
    resultCountBucket: 'none', responseStatus: 'none', responseTimeBucket: 'none', mediaType: 'none',
    failureCategory: 'none', feedbackCategory: 'none', sourceSurface: 'none', authenticated: false,
    eventCount: 0, correlatedRequestCount: 0, ...overrides,
  };
}

class FakeRepository implements InsightsRepositoryLike {
  rows: ProductAnalyticsDailyRow[] = [];
  windows: VersionActivationWindow[] = [];

  async listDaily(query: Omit<AnalyticsQuery, 'segment'>): Promise<ProductAnalyticsDailyRow[]> {
    return this.rows.filter((item) => !query.configurationVersionId || item.configurationVersionId === query.configurationVersionId);
  }
  async getVersionActivationWindows(): Promise<VersionActivationWindow[]> { return this.windows; }
  async listFeedbackInbox(query: FeedbackInboxQuery): Promise<PageDto<FeedbackInboxItemDto>> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
  }
  async categorizeFeedback(_input: CategorizeFeedbackInput, _actorUserId: string): Promise<CategorizeFeedbackResult> {
    return { status: 'conflict' };
  }
  async listAuditLog(query: AuditLogQuery, _role: AdminRole): Promise<PageDto<AuditLogItemDto>> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
  }
}

describe('InsightsService', () => {
  it('returns the exact Milestone 12 zero-data rates and healthy latency state', async () => {
    const service = new InsightsService(new FakeRepository());
    const overview = await service.getOverview({ startDate: '2026-08-01', endDate: '2026-08-07' });
    expect(overview.rates.successfulRecommendations).toEqual({ numerator: 0, denominator: 0, rate: 0 });
    expect(overview.latency).toEqual({ buckets: {}, medianBucket: null, p95Bucket: null });
    expect(overview.systemHealth.status).toBe('healthy');
  });

  it('compares activation windows with signed absolute deltas and neutral warnings', async () => {
    const repository = new FakeRepository();
    repository.windows = [
      { configurationVersionId: 'baseline', versionNumber: 1, activatedAt: new Date('2026-08-01T00:00:00.000Z'), deactivatedAt: new Date('2026-08-04T00:00:00.000Z') },
      { configurationVersionId: 'comparison', versionNumber: 2, activatedAt: new Date('2026-08-04T12:00:00.000Z'), deactivatedAt: null },
    ];
    repository.rows = [
      row({ configurationVersionId: 'baseline', eventCount: 80 }),
      row({ configurationVersionId: 'comparison', eventCount: 90 }),
      row({ configurationVersionId: 'baseline', eventName: 'recommendation_completed', responseStatus: 'success', eventCount: 40 }),
      row({ configurationVersionId: 'comparison', eventName: 'recommendation_completed', responseStatus: 'success', eventCount: 60 }),
    ];
    const service = new InsightsService(repository, () => new Date('2026-08-07T18:00:00.000Z'));
    const result = await service.compareVersions({
      startDate: '2026-08-01', endDate: '2026-08-07', baselineVersionId: 'baseline', comparisonVersionId: 'comparison',
    });
    expect(result.absoluteDeltas).toMatchObject({ recommendationRequests: 10, successfulRecommendations: 20 });
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'low_sample', 'unequal_durations', 'partial_current_utc_day',
    ]);
    expect(JSON.stringify(result.warnings)).not.toMatch(/caus|improv|worsen|because/i);
  });

  it('constructs overview DTOs without raw or identity fields', async () => {
    const repository = new FakeRepository();
    repository.rows = [row({ eventCount: 10 })];
    const dto = await new InsightsService(repository).getOverview({ startDate: '2026-08-07', endDate: '2026-08-07' });
    const serialized = JSON.stringify(dto);
    for (const prohibited of ['userId', 'prompt', 'title', 'ipAddress', 'recommendationCorrelationId']) {
      expect(serialized).not.toContain(prohibited);
    }
  });
});