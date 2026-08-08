import { describe, expect, it } from 'vitest';

import {
  analyticsQuerySchema,
  categorizeFeedbackSchema,
  feedbackInboxQuerySchema,
} from './insights-schemas';

describe('insights schemas', () => {
  it('accepts at most 93 inclusive UTC days and valid calendar dates', () => {
    expect(analyticsQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '2026-04-03' }).success).toBe(true);
    expect(analyticsQuerySchema.safeParse({ startDate: '2026-01-01', endDate: '2026-04-04' }).success).toBe(false);
    expect(analyticsQuerySchema.safeParse({ startDate: '2026-02-30', endDate: '2026-03-01' }).success).toBe(false);
    expect(analyticsQuerySchema.safeParse({ startDate: '2026-03-02', endDate: '2026-03-01' }).success).toBe(false);
  });

  it('caps pagination and rejects unsupported or privacy-sensitive filters', () => {
    const base = { startDate: '2026-08-01', endDate: '2026-08-07' };
    expect(feedbackInboxQuerySchema.safeParse({ ...base, pageSize: 100 }).success).toBe(true);
    expect(feedbackInboxQuerySchema.safeParse({ ...base, pageSize: 101 }).success).toBe(false);
    expect(analyticsQuerySchema.safeParse({ ...base, failureCategory: 'timeout' }).success).toBe(false);
    expect(feedbackInboxQuerySchema.safeParse({ ...base, userId: 'private', prompt: 'private' }).success).toBe(false);
  });

  it('requires a category, event UUID, and explicit optimistic row version state', () => {
    const input = {
      analyticsEventId: '6d83fc48-35cb-43c6-bf7e-c5e6ce53b770',
      category: 'bad_match',
      expectedRowVersion: null,
    };
    expect(categorizeFeedbackSchema.safeParse(input).success).toBe(true);
    expect(categorizeFeedbackSchema.safeParse({ ...input, category: 'other' }).success).toBe(false);
    expect(categorizeFeedbackSchema.safeParse({ ...input, expectedRowVersion: 0 }).success).toBe(false);
    expect(categorizeFeedbackSchema.safeParse({ ...input, title: 'private' }).success).toBe(false);
  });
});