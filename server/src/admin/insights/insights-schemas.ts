import { z } from 'zod';

export const INSIGHTS_MAX_RANGE_DAYS = 93;
export const INSIGHTS_MAX_PAGE_SIZE = 100;

const utcDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a UTC date in YYYY-MM-DD format').refine(
  (value) => new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
  'Expected a valid UTC date',
);

const configurationVersionIdSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/);

function utcDayNumber(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`) / 86_400_000;
}

function validateDateRange(
  value: { startDate: string; endDate: string },
  context: z.RefinementCtx,
): void {
  const startDay = utcDayNumber(value.startDate);
  const endDay = utcDayNumber(value.endDate);
  if (endDay < startDay) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'endDate must be on or after startDate' });
    return;
  }
  if (endDay - startDay + 1 > INSIGHTS_MAX_RANGE_DAYS) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: `Date range cannot exceed ${INSIGHTS_MAX_RANGE_DAYS} UTC days` });
  }
}

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(INSIGHTS_MAX_PAGE_SIZE).default(25),
};

export const analyticsQuerySchema = z.object({
  startDate: utcDateSchema,
  endDate: utcDateSchema,
  configurationVersionId: configurationVersionIdSchema.optional(),
  mediaType: z.enum(['movie', 'tv']).optional(),
  authenticated: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  sourceSurface: z.enum(['recommendations', 'library', 'profile', 'auth', 'contact']).optional(),
  segment: z.enum(['configurationVersionId', 'mediaType', 'authenticated', 'sourceSurface']).optional(),
}).strict().superRefine(validateDateRange);

export const versionComparisonQuerySchema = z.object({
  startDate: utcDateSchema,
  endDate: utcDateSchema,
  baselineVersionId: configurationVersionIdSchema,
  comparisonVersionId: configurationVersionIdSchema,
}).strict().superRefine(validateDateRange);

export const feedbackReviewCategories = [
  'bad_match',
  'already_watched',
  'not_available',
  'too_repetitive',
  'content_restriction_problem',
  'good_recommendation',
  'technical_problem',
] as const;

export const feedbackInboxQuerySchema = z.object({
  startDate: utcDateSchema,
  endDate: utcDateSchema,
  feedbackCategory: z.enum(['positive', 'negative', 'already_watched']).optional(),
  reviewCategory: z.enum(feedbackReviewCategories).optional(),
  reviewStatus: z.enum(['categorized', 'uncategorized']).optional(),
  ...paginationFields,
}).strict().superRefine(validateDateRange);

export const categorizeFeedbackSchema = z.object({
  analyticsEventId: z.string().uuid(),
  category: z.enum(feedbackReviewCategories),
  expectedRowVersion: z.number().int().min(1).nullable(),
}).strict();

export const auditLogQuerySchema = z.object({
  action: z.enum([
    'draft_created',
    'draft_saved',
    'draft_validated',
    'sandbox_executed',
    'configuration_published',
    'configuration_rolled_back',
    'feedback_categorized',
    'admin_role_changed',
    'sensitive_action_denied',
  ]).optional(),
  targetType: z.enum(['configuration', 'feedback', 'administrator', 'sandbox', 'authorization']).optional(),
  outcome: z.enum(['succeeded', 'failed', 'denied']).optional(),
  ...paginationFields,
}).strict();

export type AnalyticsQuery = z.output<typeof analyticsQuerySchema>;
export type VersionComparisonQuery = z.output<typeof versionComparisonQuerySchema>;
export type FeedbackInboxQuery = z.output<typeof feedbackInboxQuerySchema>;
export type CategorizeFeedbackInput = z.output<typeof categorizeFeedbackSchema>;
export type AuditLogQuery = z.output<typeof auditLogQuerySchema>;
export type FeedbackReviewCategory = typeof feedbackReviewCategories[number];