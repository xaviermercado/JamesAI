import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { logger } from '../utils/logger';

export const PRODUCT_ANALYTICS_RAW_RETENTION_DAYS = 90;

export const productEventNames = [
  'recommendation_requested', 'recommendation_completed', 'recommendation_failed',
  'recommendation_opened', 'recommendation_saved', 'recommendation_feedback',
  'letterboxd_sync_completed', 'letterboxd_sync_failed', 'registration_completed',
  'verification_email_succeeded', 'verification_email_failed',
  'contact_submission_succeeded', 'contact_submission_failed',
] as const;

export type ProductEventName = typeof productEventNames[number];
export type FailureCategory = 'validation' | 'no_results' | 'ai_provider' | 'metadata_provider' | 'availability_provider' | 'timeout' | 'rate_limited' | 'email_provider' | 'letterboxd_feed' | 'database' | 'unknown';

const eventSchema = z.object({
  eventName: z.enum(productEventNames),
  recommendationCorrelationId: z.string().uuid().nullable().default(null),
  resultCountBucket: z.enum(['none', '0', '1_5', '6_10', '11_20', '21_plus']).default('none'),
  responseStatus: z.enum(['none', 'success', 'empty', 'failure']).default('none'),
  responseTimeBucket: z.enum(['none', 'under_1s', '1_3s', '3_10s', 'over_10s']).default('none'),
  mediaType: z.enum(['none', 'movie', 'tv']).default('none'),
  genreFilterCount: z.number().int().min(0).max(20).default(0),
  providerFilterCount: z.number().int().min(0).max(20).default(0),
  languageFilterCount: z.number().int().min(0).max(20).default(0),
  authenticated: z.boolean().default(false),
  failureCategory: z.enum(['none', 'validation', 'no_results', 'ai_provider', 'metadata_provider', 'availability_provider', 'timeout', 'rate_limited', 'email_provider', 'letterboxd_feed', 'database', 'unknown']).default('none'),
  feedbackCategory: z.enum(['none', 'positive', 'negative', 'already_watched']).default('none'),
  sourceSurface: z.enum(['none', 'recommendations', 'library', 'profile', 'auth', 'contact']).default('none'),
}).strict().superRefine((event, context) => {
  const recommendationEvent = event.eventName.startsWith('recommendation_');
  if (recommendationEvent && !event.recommendationCorrelationId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recommendationCorrelationId'], message: 'Recommendation events require request-scoped correlation' });
  }
  if (event.eventName.endsWith('_failed') && event.failureCategory === 'none') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['failureCategory'], message: 'Failed events require a safe failure category' });
  }
});

export type ProductAnalyticsEventInput = z.input<typeof eventSchema>;
export type ValidatedProductAnalyticsEvent = z.output<typeof eventSchema> & {
  configurationVersionId: string | null;
  eventId: string;
  occurredAt: Date;
};

export interface ProductAnalyticsRecorder {
  record(input: ProductAnalyticsEventInput, now?: Date): Promise<boolean>;
}

const configurationVersionIdSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/).nullable();

export interface ProductAnalyticsRepositoryLike {
  insertEvent(event: ValidatedProductAnalyticsEvent): Promise<void>;
  aggregateUtcDay(dayStart: Date, dayEnd: Date): Promise<void>;
  deleteEventsBefore(before: Date, limit: number): Promise<number>;
  listDaily(startDate: string, endDate: string): Promise<ProductAnalyticsDailyRow[]>;
}

export interface ProductAnalyticsDailyRow {
  aggregateDate: string;
  eventName: ProductEventName | 'helpful_recommendation_request';
  configurationVersionId: string | null;
  resultCountBucket: string;
  responseStatus: string;
  responseTimeBucket: string;
  mediaType: string;
  failureCategory: string;
  feedbackCategory: string;
  sourceSurface: string;
  authenticated: boolean;
  eventCount: number;
  correlatedRequestCount: number;
}

function coarseUtcTimestamp(now: Date): Date {
  const coarse = new Date(now);
  coarse.setUTCSeconds(0, 0);
  return coarse;
}

export function createRecommendationCorrelationId(): string {
  return randomUUID();
}

export function resultCountBucket(count: number): ValidatedProductAnalyticsEvent['resultCountBucket'] {
  if (count <= 0) return '0';
  if (count <= 5) return '1_5';
  if (count <= 10) return '6_10';
  if (count <= 20) return '11_20';
  return '21_plus';
}

export function responseTimeBucket(durationMs: number): ValidatedProductAnalyticsEvent['responseTimeBucket'] {
  if (durationMs < 1000) return 'under_1s';
  if (durationMs < 3000) return '1_3s';
  if (durationMs < 10000) return '3_10s';
  return 'over_10s';
}

export function classifyFailure(error: unknown, fallback: FailureCategory = 'unknown'): FailureCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (/timeout|timed out|abort/.test(message)) return 'timeout';
  if (/rate|429/.test(message)) return 'rate_limited';
  if (/database|mysql|sql/.test(message)) return 'database';
  return fallback;
}

export class ProductAnalyticsService {
  constructor(
    private readonly repository: ProductAnalyticsRepositoryLike | null,
    private readonly activeConfigurationVersionId: string | null = null,
  ) {}

  async record(input: ProductAnalyticsEventInput, now = new Date()): Promise<boolean> {
    return this.recordForConfiguration(input, this.activeConfigurationVersionId, now);
  }

  forConfiguration(configurationVersionId: string | null): ProductAnalyticsRecorder {
    const parsedVersionId = configurationVersionIdSchema.safeParse(configurationVersionId);
    if (!parsedVersionId.success) {
      throw new Error('Invalid server configuration version ID');
    }

    return {
      record: (input, now = new Date()) => this.recordForConfiguration(input, parsedVersionId.data, now),
    };
  }

  private async recordForConfiguration(
    input: ProductAnalyticsEventInput,
    configurationVersionId: string | null,
    now: Date,
  ): Promise<boolean> {
    if (!this.repository) return false;
    const parsed = eventSchema.safeParse(input);
    if (!parsed.success) {
      logger.warn('product_analytics.event_rejected', { eventName: typeof input === 'object' && input ? input.eventName : 'invalid' });
      return false;
    }

    try {
      await this.repository.insertEvent({
        ...parsed.data,
        configurationVersionId,
        eventId: randomUUID(),
        occurredAt: coarseUtcTimestamp(now),
      });
      return true;
    } catch (error) {
      logger.error('product_analytics.write_failed', { eventName: parsed.data.eventName, error });
      return false;
    }
  }

  async runDailyMaintenance(day: string, now = new Date()): Promise<{ deleted: number }> {
    if (!this.repository) return { deleted: 0 };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('day must use YYYY-MM-DD');
    const dayStart = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(dayStart.getTime()) || dayStart.toISOString().slice(0, 10) !== day) {
      throw new Error('day must use a valid YYYY-MM-DD date');
    }
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    await this.repository.aggregateUtcDay(dayStart, dayEnd);
    const retentionBoundary = new Date(now);
    retentionBoundary.setUTCDate(retentionBoundary.getUTCDate() - PRODUCT_ANALYTICS_RAW_RETENTION_DAYS);
    return { deleted: await this.repository.deleteEventsBefore(retentionBoundary, 5000) };
  }

  async report(startDate: string, endDate: string): Promise<ProductAnalyticsDailyRow[]> {
    if (!this.repository) return [];
    return this.repository.listDaily(startDate, endDate);
  }
}
