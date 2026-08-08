import type { ProductAnalyticsReport } from '../../analytics/product-analytics-report';
import type { ProductAnalyticsDailyRow } from '../../analytics/product-analytics';
import type {
  AnalyticsQuery,
  AuditLogQuery,
  CategorizeFeedbackInput,
  FeedbackInboxQuery,
  FeedbackReviewCategory,
} from './insights-schemas';

export type AdminRole = 'editor' | 'owner';
export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface RateDto {
  numerator: number;
  denominator: number;
  rate: number;
}

export interface SystemHealthDto {
  status: HealthStatus;
  recommendationFailures: RateDto & { status: HealthStatus };
  emptyResults: RateDto & { status: HealthStatus };
  responseLatency: {
    medianBucket: string | null;
    p95Bucket: string | null;
    status: HealthStatus;
  };
  thresholds: typeof INSIGHTS_HEALTH_THRESHOLDS;
}

export const INSIGHTS_HEALTH_THRESHOLDS = {
  recommendationFailureRate: {
    warningAtOrAbove: 0.05,
    criticalAtOrAbove: 0.1,
    description: 'Failed recommendation requests divided by recommendation requests.',
  },
  emptyResultRate: {
    warningAtOrAbove: 0.25,
    criticalAtOrAbove: 0.4,
    description: 'Empty completed recommendations divided by all completed recommendations.',
  },
  p95ResponseTimeBucket: {
    warningAtOrAbove: '3_10s',
    criticalAtOrAbove: 'over_10s',
    description: 'The Milestone 12 p95 latency bucket; exact latency is not retained.',
  },
} as const;

export interface AnalyticsOverviewDto {
  range: { startDate: string; endDate: string };
  counts: {
    recommendationRequests: number;
    registrations: number;
    feedback: { positive: number; negative: number; alreadyWatched: number };
    letterboxdSync: { succeeded: number; failed: number };
    verificationEmail: { succeeded: number; failed: number };
    contactSubmissions: { succeeded: number; failed: number };
  };
  rates: {
    successfulRecommendations: RateDto;
    emptyResults: RateDto;
    recommendationFailures: RateDto & { byCategory: Record<string, number> };
    recommendationOpens: RateDto;
    saves: RateDto;
    helpfulRecommendations: RateDto;
    positiveFeedback: number;
    negativeFeedback: number;
  };
  latency: {
    buckets: Record<string, number>;
    medianBucket: string | null;
    p95Bucket: string | null;
  };
  systemHealth: SystemHealthDto;
}

export interface AnalyticsSegmentDto {
  key: string;
  overview: AnalyticsOverviewDto;
}

export interface VersionActivationWindow {
  configurationVersionId: string;
  versionNumber: number;
  activatedAt: Date;
  deactivatedAt: Date | null;
}

export interface VersionComparisonSideDto {
  configurationVersionId: string;
  versionNumber: number;
  activationWindow: { activatedAt: string; deactivatedAt: string | null };
  observedWindow: { startDate: string; endDate: string; durationMilliseconds: number };
  overview: AnalyticsOverviewDto;
}

export type VersionComparisonWarningCode = 'low_sample' | 'unequal_durations' | 'partial_current_utc_day';

export interface VersionComparisonDto {
  baseline: VersionComparisonSideDto;
  comparison: VersionComparisonSideDto;
  absoluteDeltas: {
    kind: 'comparison_minus_baseline';
    recommendationRequests: number;
    successfulRecommendations: number;
    recommendationFailures: number;
    helpfulRecommendations: number;
    positiveFeedback: number;
    successRate: number;
    failureRate: number;
    helpfulRate: number;
  };
  warnings: Array<{ code: VersionComparisonWarningCode; message: string }>;
}

export interface FeedbackInboxItemDto {
  analyticsEventId: string;
  occurredAt: string;
  configurationVersionId: string | null;
  mediaType: 'none' | 'movie' | 'tv';
  feedbackCategory: 'positive' | 'negative' | 'already_watched';
  sourceSurface: 'none' | 'recommendations' | 'library' | 'profile' | 'auth' | 'contact';
  authenticated: boolean;
  review: null | {
    category: FeedbackReviewCategory;
    categorizedAt: string;
    rowVersion: number;
  };
}

export interface CategorizedFeedbackDto {
  analyticsEventId: string;
  category: FeedbackReviewCategory;
  categorizedAt: string;
  rowVersion: number;
}

export interface AuditLogItemDto {
  auditId: string;
  actorUserId: string | null;
  action: AuditLogQuery['action'] extends infer T ? Exclude<T, undefined> : never;
  targetType: AuditLogQuery['targetType'] extends infer T ? Exclude<T, undefined> : never;
  targetId: string | null;
  outcome: AuditLogQuery['outcome'] extends infer T ? Exclude<T, undefined> : never;
  summary: Record<string, unknown>;
  occurredAt: string;
}

export interface PageDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type CategorizeFeedbackResult =
  | { status: 'updated'; item: CategorizedFeedbackDto }
  | { status: 'not_found' }
  | { status: 'conflict' };

export interface InsightsRepositoryLike {
  listDaily(query: Omit<AnalyticsQuery, 'segment'>): Promise<ProductAnalyticsDailyRow[]>;
  getVersionActivationWindows(versionIds: string[]): Promise<VersionActivationWindow[]>;
  listFeedbackInbox(query: FeedbackInboxQuery): Promise<PageDto<FeedbackInboxItemDto>>;
  categorizeFeedback(input: CategorizeFeedbackInput, actorUserId: string): Promise<CategorizeFeedbackResult>;
  listAuditLog(query: AuditLogQuery, role: AdminRole): Promise<PageDto<AuditLogItemDto>>;
}

export type ProductReport = ProductAnalyticsReport;