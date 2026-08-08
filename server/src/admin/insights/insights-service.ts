import { buildProductAnalyticsReport } from '../../analytics/product-analytics-report';
import type { ProductAnalyticsDailyRow } from '../../analytics/product-analytics';
import type {
  AnalyticsQuery,
  AuditLogQuery,
  CategorizeFeedbackInput,
  FeedbackInboxQuery,
  VersionComparisonQuery,
} from './insights-schemas';
import {
  INSIGHTS_HEALTH_THRESHOLDS,
  type AdminRole,
  type AnalyticsOverviewDto,
  type AnalyticsSegmentDto,
  type CategorizeFeedbackResult,
  type HealthStatus,
  type InsightsRepositoryLike,
  type VersionActivationWindow,
  type VersionComparisonDto,
  type VersionComparisonSideDto,
} from './insights-types';

const UTC_DAY_MS = 86_400_000;
const LOW_SAMPLE_REQUESTS = 100;

function rateStatus(rate: number, warning: number, critical: number): HealthStatus {
  if (rate >= critical) return 'critical';
  if (rate >= warning) return 'warning';
  return 'healthy';
}

function latencyStatus(bucket: string | null): HealthStatus {
  if (bucket === 'over_10s') return 'critical';
  if (bucket === '3_10s') return 'warning';
  return 'healthy';
}

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  return 'healthy';
}

function toOverview(rows: ProductAnalyticsDailyRow[], startDate: string, endDate: string): AnalyticsOverviewDto {
  const report = buildProductAnalyticsReport(rows);
  const failureStatus = rateStatus(
    report.recommendationFailures.rate,
    INSIGHTS_HEALTH_THRESHOLDS.recommendationFailureRate.warningAtOrAbove,
    INSIGHTS_HEALTH_THRESHOLDS.recommendationFailureRate.criticalAtOrAbove,
  );
  const emptyStatus = rateStatus(
    report.emptyResults.rate,
    INSIGHTS_HEALTH_THRESHOLDS.emptyResultRate.warningAtOrAbove,
    INSIGHTS_HEALTH_THRESHOLDS.emptyResultRate.criticalAtOrAbove,
  );
  const responseLatencyStatus = latencyStatus(report.p95ResponseTimeBucket);

  return {
    range: { startDate, endDate },
    counts: {
      recommendationRequests: report.recommendationRequests,
      registrations: report.registrations,
      feedback: {
        positive: report.feedback.positive,
        negative: report.feedback.negative,
        alreadyWatched: report.feedback.alreadyWatched,
      },
      letterboxdSync: report.letterboxdSync,
      verificationEmail: report.verificationEmail,
      contactSubmissions: report.contactSubmissions,
    },
    rates: {
      successfulRecommendations: report.successfulRecommendations,
      emptyResults: report.emptyResults,
      recommendationFailures: report.recommendationFailures,
      recommendationOpens: report.recommendationOpens,
      saves: report.saves,
      helpfulRecommendations: report.helpfulRecommendations,
      positiveFeedback: report.feedback.positiveRate,
      negativeFeedback: report.feedback.negativeRate,
    },
    latency: {
      buckets: report.responseTimeBuckets,
      medianBucket: report.medianResponseTimeBucket,
      p95Bucket: report.p95ResponseTimeBucket,
    },
    systemHealth: {
      status: worstStatus([failureStatus, emptyStatus, responseLatencyStatus]),
      recommendationFailures: { ...report.recommendationFailures, status: failureStatus },
      emptyResults: { ...report.emptyResults, status: emptyStatus },
      responseLatency: {
        medianBucket: report.medianResponseTimeBucket,
        p95Bucket: report.p95ResponseTimeBucket,
        status: responseLatencyStatus,
      },
      thresholds: INSIGHTS_HEALTH_THRESHOLDS,
    },
  };
}

function segmentKey(row: ProductAnalyticsDailyRow, segment: NonNullable<AnalyticsQuery['segment']>): string {
  if (segment === 'configurationVersionId') return row.configurationVersionId ?? 'unversioned';
  if (segment === 'authenticated') return String(row.authenticated);
  return row[segment];
}

function dateAtUtcStart(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateAtUtcEndExclusive(value: string): Date {
  return new Date(dateAtUtcStart(value).getTime() + UTC_DAY_MS);
}

function observedWindow(query: VersionComparisonQuery, window: VersionActivationWindow) {
  const start = new Date(Math.max(dateAtUtcStart(query.startDate).getTime(), window.activatedAt.getTime()));
  const end = new Date(Math.min(dateAtUtcEndExclusive(query.endDate).getTime(), window.deactivatedAt?.getTime() ?? Number.POSITIVE_INFINITY));
  if (end.getTime() <= start.getTime()) throw new Error(`Configuration version ${window.configurationVersionId} has no activation time in the requested range`);
  return {
    start,
    end,
    startDate: start.toISOString().slice(0, 10),
    endDate: new Date(end.getTime() - 1).toISOString().slice(0, 10),
    durationMilliseconds: end.getTime() - start.getTime(),
  };
}

export class InsightsService {
  constructor(
    private readonly repository: InsightsRepositoryLike,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getOverview(query: AnalyticsQuery): Promise<AnalyticsOverviewDto> {
    const { segment: _segment, ...filters } = query;
    return toOverview(await this.repository.listDaily(filters), query.startDate, query.endDate);
  }

  async getSegments(query: AnalyticsQuery): Promise<AnalyticsSegmentDto[]> {
    if (!query.segment) return [];
    const { segment, ...filters } = query;
    const rows = await this.repository.listDaily(filters);
    const grouped = new Map<string, ProductAnalyticsDailyRow[]>();
    for (const row of rows) {
      const key = segmentKey(row, segment);
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, segmentRows]) => ({
      key,
      overview: toOverview(segmentRows, query.startDate, query.endDate),
    }));
  }

  async compareVersions(query: VersionComparisonQuery): Promise<VersionComparisonDto> {
    const windows = await this.repository.getVersionActivationWindows([query.baselineVersionId, query.comparisonVersionId]);
    const baselineWindow = windows.find((window) => window.configurationVersionId === query.baselineVersionId);
    const comparisonWindow = windows.find((window) => window.configurationVersionId === query.comparisonVersionId);
    if (!baselineWindow || !comparisonWindow) throw new Error('Both configuration versions require an activation window');

    const baseline = await this.comparisonSide(query, baselineWindow);
    const comparison = await this.comparisonSide(query, comparisonWindow);
    const warnings: VersionComparisonDto['warnings'] = [];
    if (baseline.overview.counts.recommendationRequests < LOW_SAMPLE_REQUESTS || comparison.overview.counts.recommendationRequests < LOW_SAMPLE_REQUESTS) {
      warnings.push({ code: 'low_sample', message: 'At least one version has fewer than 100 recommendation requests; interpret differences cautiously.' });
    }
    if (baseline.observedWindow.durationMilliseconds !== comparison.observedWindow.durationMilliseconds) {
      warnings.push({ code: 'unequal_durations', message: 'The compared activation windows have unequal durations; counts are not duration-normalized.' });
    }
    const today = this.now().toISOString().slice(0, 10);
    if (baseline.observedWindow.endDate === today || comparison.observedWindow.endDate === today) {
      warnings.push({ code: 'partial_current_utc_day', message: 'The comparison includes the current UTC day, which may be incomplete.' });
    }

    return {
      baseline,
      comparison,
      absoluteDeltas: {
        kind: 'comparison_minus_baseline',
        recommendationRequests: comparison.overview.counts.recommendationRequests - baseline.overview.counts.recommendationRequests,
        successfulRecommendations: comparison.overview.rates.successfulRecommendations.numerator - baseline.overview.rates.successfulRecommendations.numerator,
        recommendationFailures: comparison.overview.rates.recommendationFailures.numerator - baseline.overview.rates.recommendationFailures.numerator,
        helpfulRecommendations: comparison.overview.rates.helpfulRecommendations.numerator - baseline.overview.rates.helpfulRecommendations.numerator,
        positiveFeedback: comparison.overview.counts.feedback.positive - baseline.overview.counts.feedback.positive,
        successRate: comparison.overview.rates.successfulRecommendations.rate - baseline.overview.rates.successfulRecommendations.rate,
        failureRate: comparison.overview.rates.recommendationFailures.rate - baseline.overview.rates.recommendationFailures.rate,
        helpfulRate: comparison.overview.rates.helpfulRecommendations.rate - baseline.overview.rates.helpfulRecommendations.rate,
      },
      warnings,
    };
  }

  listFeedbackInbox(query: FeedbackInboxQuery) {
    return this.repository.listFeedbackInbox(query);
  }

  categorizeFeedback(input: CategorizeFeedbackInput, actorUserId: string): Promise<CategorizeFeedbackResult> {
    return this.repository.categorizeFeedback(input, actorUserId);
  }

  listAuditLog(query: AuditLogQuery, role: AdminRole) {
    return this.repository.listAuditLog(query, role);
  }

  private async comparisonSide(query: VersionComparisonQuery, window: VersionActivationWindow): Promise<VersionComparisonSideDto> {
    const observed = observedWindow(query, window);
    const rows = await this.repository.listDaily({
      startDate: observed.startDate,
      endDate: observed.endDate,
      configurationVersionId: window.configurationVersionId,
    });
    return {
      configurationVersionId: window.configurationVersionId,
      versionNumber: window.versionNumber,
      activationWindow: {
        activatedAt: window.activatedAt.toISOString(),
        deactivatedAt: window.deactivatedAt?.toISOString() ?? null,
      },
      observedWindow: {
        startDate: observed.startDate,
        endDate: observed.endDate,
        durationMilliseconds: observed.durationMilliseconds,
      },
      overview: toOverview(rows, observed.startDate, observed.endDate),
    };
  }
}