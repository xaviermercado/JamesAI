import type { Pool, PoolConnection } from 'mysql2';

import type { ProductAnalyticsDailyRow } from '../../analytics/product-analytics';
import type {
  AnalyticsQuery,
  AuditLogQuery,
  CategorizeFeedbackInput,
  FeedbackInboxQuery,
} from './insights-schemas';
import type {
  AdminRole,
  AuditLogItemDto,
  CategorizeFeedbackResult,
  CategorizedFeedbackDto,
  FeedbackInboxItemDto,
  InsightsRepositoryLike,
  PageDto,
  VersionActivationWindow,
} from './insights-types';

type PromisePool = ReturnType<Pool['promise']>;
type QueryExecutor = Pick<PoolConnection, 'query'>;

export interface FeedbackCategorizationAuditInput {
  actorUserId: string;
  analyticsEventId: string;
  category: CategorizedFeedbackDto['category'];
  previousRowVersion: number | null;
  rowVersion: number;
}

export interface FeedbackCategorizationAuditAppender {
  appendFeedbackCategorized(input: FeedbackCategorizationAuditInput, executor: QueryExecutor): Promise<void>;
}

export class MySqlFeedbackCategorizationAuditAppender implements FeedbackCategorizationAuditAppender {
  async appendFeedbackCategorized(input: FeedbackCategorizationAuditInput, executor: QueryExecutor): Promise<void> {
    await executor.query(
      `INSERT INTO james_admin_audit_log (
        audit_id, actor_user_id, action, target_type, target_id, outcome, summary_json, occurred_at
      ) VALUES (UUID(), ?, 'feedback_categorized', 'feedback', ?, 'succeeded', ?, NOW(3))`,
      [
        input.actorUserId,
        input.analyticsEventId,
        JSON.stringify({
          category: input.category,
          previousRowVersion: input.previousRowVersion,
          rowVersion: input.rowVersion,
        }),
      ],
    );
  }
}

function mapDailyRow(row: Record<string, unknown>): ProductAnalyticsDailyRow {
  return {
    aggregateDate: row.aggregate_date instanceof Date ? row.aggregate_date.toISOString().slice(0, 10) : String(row.aggregate_date),
    eventName: row.event_name as ProductAnalyticsDailyRow['eventName'],
    configurationVersionId: String(row.configuration_version_id || '') || null,
    resultCountBucket: String(row.result_count_bucket),
    responseStatus: String(row.response_status),
    responseTimeBucket: String(row.response_time_bucket),
    mediaType: String(row.media_type),
    failureCategory: String(row.failure_category),
    feedbackCategory: String(row.feedback_category),
    sourceSurface: String(row.source_surface),
    authenticated: Boolean(row.authenticated),
    eventCount: Number(row.event_count),
    correlatedRequestCount: Number(row.correlated_request_count),
  };
}

function isoDate(value: unknown): string {
  return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

function parseSummary(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}

export class InsightsRepository implements InsightsRepositoryLike {
  constructor(
    private readonly pool: PromisePool,
    private readonly auditAppender: FeedbackCategorizationAuditAppender = new MySqlFeedbackCategorizationAuditAppender(),
  ) {}

  async listDaily(query: Omit<AnalyticsQuery, 'segment'>): Promise<ProductAnalyticsDailyRow[]> {
    const conditions = ['aggregate_date >= ?', 'aggregate_date <= ?'];
    const parameters: unknown[] = [query.startDate, query.endDate];
    if (query.configurationVersionId) {
      conditions.push('configuration_version_id = ?');
      parameters.push(query.configurationVersionId);
    }
    if (query.mediaType) {
      conditions.push('media_type = ?');
      parameters.push(query.mediaType);
    }
    if (query.authenticated !== undefined) {
      conditions.push('authenticated = ?');
      parameters.push(query.authenticated ? 1 : 0);
    }
    if (query.sourceSurface) {
      conditions.push('source_surface = ?');
      parameters.push(query.sourceSurface);
    }

    const [rows] = await this.pool.query(
      `SELECT aggregate_date, event_name, configuration_version_id, result_count_bucket,
        response_status, response_time_bucket, media_type, failure_category,
        feedback_category, source_surface, authenticated, event_count, correlated_request_count
       FROM product_analytics_daily
       WHERE ${conditions.join(' AND ')}
       ORDER BY aggregate_date ASC, event_name ASC`,
      parameters,
    );
    return (rows as Array<Record<string, unknown>>).map(mapDailyRow);
  }

  async getVersionActivationWindows(versionIds: string[]): Promise<VersionActivationWindow[]> {
    const uniqueIds = [...new Set(versionIds)];
    if (uniqueIds.length === 0) return [];
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const [rows] = await this.pool.query(
      `SELECT configuration_id, version_number, published_at AS activated_at,
        (SELECT MIN(next_configuration.published_at)
         FROM james_configurations next_configuration
         WHERE next_configuration.published_at > configuration.published_at
           AND next_configuration.status IN ('published', 'superseded')) AS deactivated_at
       FROM james_configurations configuration
       WHERE configuration_id IN (${placeholders})
         AND published_at IS NOT NULL
         AND status IN ('published', 'superseded')`,
      uniqueIds,
    );
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      configurationVersionId: String(row.configuration_id),
      versionNumber: Number(row.version_number),
      activatedAt: row.activated_at instanceof Date ? row.activated_at : new Date(String(row.activated_at)),
      deactivatedAt: row.deactivated_at ? (row.deactivated_at instanceof Date ? row.deactivated_at : new Date(String(row.deactivated_at))) : null,
    }));
  }

  async listFeedbackInbox(query: FeedbackInboxQuery): Promise<PageDto<FeedbackInboxItemDto>> {
    const conditions = [
      "event.event_name = 'recommendation_feedback'",
      'event.occurred_at >= ?',
      'event.occurred_at < DATE_ADD(?, INTERVAL 1 DAY)',
    ];
    const parameters: unknown[] = [query.startDate, query.endDate];
    if (query.feedbackCategory) {
      conditions.push('event.feedback_category = ?');
      parameters.push(query.feedbackCategory);
    }
    if (query.reviewCategory) {
      conditions.push('review.category = ?');
      parameters.push(query.reviewCategory);
    }
    if (query.reviewStatus) conditions.push(query.reviewStatus === 'categorized' ? 'review.review_id IS NOT NULL' : 'review.review_id IS NULL');

    const where = conditions.join(' AND ');
    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS total
       FROM product_analytics_events event
       LEFT JOIN james_feedback_reviews review ON review.analytics_event_id = event.event_id
       WHERE ${where}`,
      parameters,
    );
    const offset = (query.page - 1) * query.pageSize;
    const [rows] = await this.pool.query(
      `SELECT event.event_id, event.occurred_at, event.configuration_version_id,
        event.media_type, event.feedback_category, event.source_surface, event.authenticated,
        review.category, review.categorized_at, review.row_version
       FROM product_analytics_events event
       LEFT JOIN james_feedback_reviews review ON review.analytics_event_id = event.event_id
       WHERE ${where}
       ORDER BY event.occurred_at DESC, event.event_id DESC
       LIMIT ${query.pageSize} OFFSET ${offset}`,
      parameters,
    );
    const items = (rows as Array<Record<string, unknown>>).map((row): FeedbackInboxItemDto => ({
      analyticsEventId: String(row.event_id),
      occurredAt: isoDate(row.occurred_at),
      configurationVersionId: String(row.configuration_version_id || '') || null,
      mediaType: row.media_type as FeedbackInboxItemDto['mediaType'],
      feedbackCategory: row.feedback_category as FeedbackInboxItemDto['feedbackCategory'],
      sourceSurface: row.source_surface as FeedbackInboxItemDto['sourceSurface'],
      authenticated: Boolean(row.authenticated),
      review: row.category ? {
        category: row.category as NonNullable<FeedbackInboxItemDto['review']>['category'],
        categorizedAt: isoDate(row.categorized_at),
        rowVersion: Number(row.row_version),
      } : null,
    }));
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: Number((countRows as Array<Record<string, unknown>>)[0]?.total ?? 0),
    };
  }

  async categorizeFeedback(input: CategorizeFeedbackInput, actorUserId: string): Promise<CategorizeFeedbackResult> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [eventRowsResult] = await connection.query(
        "SELECT event_id FROM product_analytics_events WHERE event_id = ? AND event_name = 'recommendation_feedback' LIMIT 1",
        [input.analyticsEventId],
      );
      const eventRows = eventRowsResult as Array<Record<string, unknown>>;
      if (eventRows.length === 0) {
        await connection.rollback();
        return { status: 'not_found' };
      }

      if (input.expectedRowVersion === null) {
        try {
          await connection.query(
            `INSERT INTO james_feedback_reviews (
              review_id, analytics_event_id, category, categorized_by_user_id, categorized_at, row_version
            ) VALUES (UUID(), ?, ?, ?, NOW(3), 1)`,
            [input.analyticsEventId, input.category, actorUserId],
          );
        } catch (error) {
          if (!isDuplicateKey(error)) throw error;
          await connection.rollback();
          return { status: 'conflict' };
        }
      } else {
        const [result] = await connection.query(
          `UPDATE james_feedback_reviews
           SET category = ?, categorized_by_user_id = ?, categorized_at = NOW(3), row_version = row_version + 1
           WHERE analytics_event_id = ? AND row_version = ?`,
          [input.category, actorUserId, input.analyticsEventId, input.expectedRowVersion],
        );
        if ((result as { affectedRows?: number }).affectedRows !== 1) {
          await connection.rollback();
          return { status: 'conflict' };
        }
      }

      const [reviewRowsResult] = await connection.query(
        `SELECT analytics_event_id, category, categorized_at, row_version
         FROM james_feedback_reviews WHERE analytics_event_id = ? LIMIT 1`,
        [input.analyticsEventId],
      );
      const reviewRows = reviewRowsResult as Array<Record<string, unknown>>;
      const review = reviewRows[0];
      if (!review) throw new Error('Categorized feedback could not be read');
      const item: CategorizedFeedbackDto = {
        analyticsEventId: String(review.analytics_event_id),
        category: review.category as CategorizedFeedbackDto['category'],
        categorizedAt: isoDate(review.categorized_at),
        rowVersion: Number(review.row_version),
      };
      await this.auditAppender.appendFeedbackCategorized({
        actorUserId,
        analyticsEventId: item.analyticsEventId,
        category: item.category,
        previousRowVersion: input.expectedRowVersion,
        rowVersion: item.rowVersion,
      }, connection);
      await connection.commit();
      return { status: 'updated', item };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listAuditLog(query: AuditLogQuery, role: AdminRole): Promise<PageDto<AuditLogItemDto>> {
    const conditions: string[] = [];
    const parameters: unknown[] = [];
    if (role === 'editor') conditions.push("target_type IN ('configuration', 'sandbox')");
    if (query.action) {
      conditions.push('action = ?');
      parameters.push(query.action);
    }
    if (query.targetType) {
      conditions.push('target_type = ?');
      parameters.push(query.targetType);
    }
    if (query.outcome) {
      conditions.push('outcome = ?');
      parameters.push(query.outcome);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await this.pool.query(`SELECT COUNT(*) AS total FROM james_admin_audit_log ${where}`, parameters);
    const offset = (query.page - 1) * query.pageSize;
    const [rows] = await this.pool.query(
      `SELECT audit_id, actor_user_id, action, target_type, target_id, outcome, summary_json, occurred_at
       FROM james_admin_audit_log ${where}
       ORDER BY occurred_at DESC, audit_id DESC
       LIMIT ${query.pageSize} OFFSET ${offset}`,
      parameters,
    );
    return {
      items: (rows as Array<Record<string, unknown>>).map((row) => ({
        auditId: String(row.audit_id),
        actorUserId: String(row.actor_user_id || '') || null,
        action: row.action as AuditLogItemDto['action'],
        targetType: row.target_type as AuditLogItemDto['targetType'],
        targetId: String(row.target_id || '') || null,
        outcome: row.outcome as AuditLogItemDto['outcome'],
        summary: parseSummary(row.summary_json),
        occurredAt: isoDate(row.occurred_at),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: Number((countRows as Array<Record<string, unknown>>)[0]?.total ?? 0),
    };
  }
}