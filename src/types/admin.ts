export type AdminRole = 'user' | 'editor' | 'owner';

export type AdminCapability =
  | 'view_insights'
  | 'view_minimized_feedback'
  | 'create_configuration'
  | 'edit_configuration'
  | 'validate_configuration'
  | 'preview_configuration'
  | 'run_sandbox'
  | 'view_configuration_audit'
  | 'publish_configuration'
  | 'rollback_configuration'
  | 'manage_admin_access'
  | 'view_full_audit';

export type PriorityPosition = -2 | -1 | 0 | 1 | 2;
export type MediaType = 'movie' | 'tv';

export interface PriorityItem<T> {
  id: T;
  position: PriorityPosition;
}

export interface TitleControl {
  mediaType: MediaType;
  tmdbId: number;
}

export interface GuidanceCampaign {
  campaignId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  priorityBoost: PriorityPosition;
  providerIds: number[];
  genreIds: number[];
  languageCodes: string[];
  titleIds: TitleControl[];
  editorialNote: string | null;
}

export interface JamesConfiguration {
  schemaVersion: 1;
  philosophy: { statement: string | null; editorialNotes: string[] };
  priorityAxes: {
    popularityVsDiscovery: PriorityPosition;
    mainstreamVsNiche: PriorityPosition;
    recentVsClassic: PriorityPosition;
    safeVsAdventurous: PriorityPosition;
    conciseVsEpic: PriorityPosition;
    familiarVsDiverse: PriorityPosition;
  };
  contentPriorities: {
    providers: PriorityItem<number>[];
    genres: PriorityItem<number>[];
    languages: PriorityItem<string>[];
  };
  rules: {
    hard: {
      mediaTypes: MediaType[];
      providerIds: number[];
      genreIds: number[];
      languageCodes: string[];
      minimumRating: number | null;
      maximumRuntimeMinutes: number | null;
      earliestReleaseYear: number | null;
      latestReleaseYear: number | null;
    };
    soft: {
      minimumRating: number | null;
      targetRuntimeMinutes: number | null;
      targetReleaseYear: number | null;
    };
  };
  campaigns: GuidanceCampaign[];
  titleControls: { include: TitleControl[]; exclude: TitleControl[] };
}

export interface ConfigurationFieldError {
  field: string;
  message: string;
}

export type ConfigurationStatus = 'draft' | 'published' | 'superseded';
export type ValidationStatus = 'pending' | 'valid' | 'invalid';

export interface StoredConfiguration {
  configurationId: string;
  versionNumber: number;
  status: ConfigurationStatus;
  schemaVersion: number;
  configurationHash: string;
  changeReason: string | null;
  validationStatus: ValidationStatus;
  configuration: JamesConfiguration;
  validationErrors: ConfigurationFieldError[] | null;
  validatedAt: string | null;
  sourceConfigurationId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  publishedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  rowVersion: number;
}

export interface ConfigurationAdapterOutput {
  schemaVersion: 1;
  filters: {
    mediaTypes: MediaType[];
    providerIds: number[];
    genreIds: number[];
    languageCodes: string[];
    minimumRating: number | null;
    maximumRuntimeMinutes: number | null;
    releaseYear: { minimum: number | null; maximum: number | null };
    includedTitleKeys: string[];
    excludedTitleKeys: string[];
  };
  ranking: {
    axes: JamesConfiguration['priorityAxes'];
    providerPriorities: PriorityItem<number>[];
    genrePriorities: PriorityItem<number>[];
    languagePriorities: PriorityItem<string>[];
    softTargets: JamesConfiguration['rules']['soft'];
    activeCampaigns: {
      campaignId: string;
      priorityBoost: number;
      providerIds: number[];
      genreIds: number[];
      languageCodes: string[];
      titleKeys: string[];
    }[];
  };
  editorialContext: { philosophy: string | null; notes: string[]; campaignNotes: string[] };
  precedence: string[];
}

export interface RateDto {
  numerator: number;
  denominator: number;
  rate: number;
}

export type HealthStatus = 'healthy' | 'warning' | 'critical';

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
  latency: { buckets: Record<string, number>; medianBucket: string | null; p95Bucket: string | null };
  systemHealth: {
    status: HealthStatus;
    recommendationFailures: RateDto & { status: HealthStatus };
    emptyResults: RateDto & { status: HealthStatus };
    responseLatency: { medianBucket: string | null; p95Bucket: string | null; status: HealthStatus };
  };
}

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
  warnings: { code: 'low_sample' | 'unequal_durations' | 'partial_current_utc_day'; message: string }[];
}

export interface VersionComparisonSideDto {
  configurationVersionId: string;
  versionNumber: number;
  activationWindow: { activatedAt: string; deactivatedAt: string | null };
  observedWindow: { startDate: string; endDate: string; durationMilliseconds: number };
  overview: AnalyticsOverviewDto;
}

export const FEEDBACK_REVIEW_CATEGORIES = [
  'bad_match',
  'already_watched',
  'not_available',
  'too_repetitive',
  'content_restriction_problem',
  'good_recommendation',
  'technical_problem',
] as const;

export type FeedbackReviewCategory = (typeof FEEDBACK_REVIEW_CATEGORIES)[number];

export interface FeedbackInboxItemDto {
  analyticsEventId: string;
  occurredAt: string;
  configurationVersionId: string | null;
  mediaType: 'none' | MediaType;
  feedbackCategory: 'positive' | 'negative' | 'already_watched';
  sourceSurface: 'none' | 'recommendations' | 'library' | 'profile' | 'auth' | 'contact';
  authenticated: boolean;
  review: null | { category: FeedbackReviewCategory; categorizedAt: string; rowVersion: number };
}

export interface AuditLogItemDto {
  auditId: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  outcome: 'succeeded' | 'failed' | 'denied';
  summary: Record<string, unknown>;
  occurredAt: string;
}

export interface AdminAccessItemDto {
  userId: string;
  email: string;
  accountStatus: 'pending_verification' | 'active' | 'disabled';
  adminRole: AdminRole;
  updatedAt: string;
}

export interface PageDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DateRangeQuery {
  startDate: string;
  endDate: string;
}

export interface SandboxExample {
  description: string;
  mediaType: MediaType;
  country?: string;
}

export interface SandboxResultDto {
  activeConfigurationId: string;
  selectedConfigurationId: string;
  results: {
    example: number;
    active: { count: number; items: SandboxRecommendationDto[] };
    selected: { count: number; items: SandboxRecommendationDto[] };
  }[];
}

export interface SandboxRecommendationDto {
  title: string;
  mediaType: MediaType;
  availability: 'available' | 'unknown';
  explanation: string;
}