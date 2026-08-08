import { describe, expect, it, vi } from 'vitest';

import { InsightsRepository, type FeedbackCategorizationAuditAppender } from './insights-repository';

function createConnection(updateAffectedRows: number) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('SELECT event_id')) return [[{ event_id: '6d83fc48-35cb-43c6-bf7e-c5e6ce53b770' }]];
    if (sql.includes('UPDATE james_feedback_reviews')) return [{ affectedRows: updateAffectedRows }];
    if (sql.includes('SELECT analytics_event_id')) return [[{
      analytics_event_id: '6d83fc48-35cb-43c6-bf7e-c5e6ce53b770',
      category: 'technical_problem',
      categorized_at: new Date('2026-08-07T12:00:00.000Z'),
      row_version: 3,
    }]];
    return [{}];
  });
  return {
    query,
    beginTransaction: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    release: vi.fn(),
  };
}

describe('InsightsRepository', () => {
  it('returns a conflict and does not append audit when optimistic row_version is stale', async () => {
    const connection = createConnection(0);
    const auditAppender: FeedbackCategorizationAuditAppender = { appendFeedbackCategorized: vi.fn() };
    const pool = { getConnection: vi.fn(async () => connection) };
    const repository = new InsightsRepository(pool as never, auditAppender);
    const result = await repository.categorizeFeedback({
      analyticsEventId: '6d83fc48-35cb-43c6-bf7e-c5e6ce53b770', category: 'technical_problem', expectedRowVersion: 2,
    }, 'actor-id');
    expect(result).toEqual({ status: 'conflict' });
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(auditAppender.appendFeedbackCategorized).not.toHaveBeenCalled();
  });

  it('updates row_version and appends audit in the transaction on success', async () => {
    const connection = createConnection(1);
    const auditAppender: FeedbackCategorizationAuditAppender = { appendFeedbackCategorized: vi.fn(async () => undefined) };
    const pool = { getConnection: vi.fn(async () => connection) };
    const repository = new InsightsRepository(pool as never, auditAppender);
    const result = await repository.categorizeFeedback({
      analyticsEventId: '6d83fc48-35cb-43c6-bf7e-c5e6ce53b770', category: 'technical_problem', expectedRowVersion: 2,
    }, 'actor-id');
    expect(result).toMatchObject({ status: 'updated', item: { rowVersion: 3 } });
    expect(auditAppender.appendFeedbackCategorized).toHaveBeenCalledWith(expect.objectContaining({
      previousRowVersion: 2, rowVersion: 3,
    }), connection);
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it('selects only minimized feedback fields and applies role-specific audit filtering', async () => {
    const queries: string[] = [];
    const pool = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return sql.includes('COUNT(*)') ? [[{ total: 0 }]] : [[]];
      }),
    };
    const repository = new InsightsRepository(pool as never);
    await repository.listFeedbackInbox({ startDate: '2026-08-01', endDate: '2026-08-07', page: 1, pageSize: 25 });
    await repository.listAuditLog({ page: 1, pageSize: 25 }, 'editor');
    const editorAuditQueries = queries.filter((sql) => sql.includes('james_admin_audit_log'));
    queries.length = 0;
    await repository.listAuditLog({ page: 1, pageSize: 25 }, 'owner');
    const feedbackSelect = queries.find((sql) => sql.includes('SELECT event.event_id')) ?? '';
    expect(feedbackSelect).toBe('');
    expect(editorAuditQueries.every((sql) => sql.includes("target_type IN ('configuration', 'sandbox')"))).toBe(true);
    expect(queries.filter((sql) => sql.includes('james_admin_audit_log')).every((sql) => !sql.includes('target_type IN'))).toBe(true);
  });

  it('never selects prohibited raw feedback fields', async () => {
    const queries: string[] = [];
    const pool = { query: vi.fn(async (sql: string) => {
      queries.push(sql);
      return sql.includes('COUNT(*)') ? [[{ total: 0 }]] : [[]];
    }) };
    await new InsightsRepository(pool as never).listFeedbackInbox({
      startDate: '2026-08-01', endDate: '2026-08-07', page: 1, pageSize: 25,
    });
    const feedbackSelect = queries.find((sql) => sql.includes('SELECT event.event_id')) ?? '';
    expect(feedbackSelect).not.toMatch(/recommendation_correlation_id|prompt|title|user_id|ip/i);
  });
});