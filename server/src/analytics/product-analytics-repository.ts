import type { Pool } from 'mysql2';

import type { ProductAnalyticsDailyRow, ProductAnalyticsRepositoryLike, ValidatedProductAnalyticsEvent } from './product-analytics';

type PromisePool = ReturnType<Pool['promise']>;

export class ProductAnalyticsRepository implements ProductAnalyticsRepositoryLike {
  constructor(private readonly pool: PromisePool) {}

  async insertEvent(event: ValidatedProductAnalyticsEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO product_analytics_events (
        event_id, recommendation_correlation_id, event_name, occurred_at, configuration_version_id,
        result_count_bucket, response_status, response_time_bucket, media_type,
        genre_filter_count, provider_filter_count, language_filter_count, authenticated,
        failure_category, feedback_category, source_surface
      ) VALUES (?, ?, ?, ?, COALESCE(?, (
        SELECT inherited.configuration_version_id
        FROM product_analytics_events AS inherited
        WHERE inherited.recommendation_correlation_id = ?
          AND inherited.configuration_version_id IS NOT NULL
        ORDER BY inherited.occurred_at ASC
        LIMIT 1
      )), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId, event.recommendationCorrelationId, event.eventName, event.occurredAt,
        event.configurationVersionId, event.recommendationCorrelationId,
        event.resultCountBucket, event.responseStatus,
        event.responseTimeBucket, event.mediaType, event.genreFilterCount,
        event.providerFilterCount, event.languageFilterCount, event.authenticated ? 1 : 0,
        event.failureCategory, event.feedbackCategory, event.sourceSurface,
      ],
    );
  }

  async aggregateUtcDay(dayStart: Date, dayEnd: Date): Promise<void> {
    const connection = await this.pool.getConnection();
    const aggregateDate = dayStart.toISOString().slice(0, 10);
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM product_analytics_daily WHERE aggregate_date = ?', [aggregateDate]);
      await connection.query(
        `INSERT INTO product_analytics_daily (
          aggregate_date, aggregate_key, event_name, configuration_version_id, result_count_bucket,
          response_status, response_time_bucket, media_type, failure_category,
          feedback_category, source_surface, authenticated, event_count, correlated_request_count
        )
        SELECT ?, UNHEX(SHA2(CONCAT_WS('|', event_name, COALESCE(configuration_version_id, ''),
          result_count_bucket, response_status, response_time_bucket, media_type, failure_category,
          feedback_category, source_surface, authenticated), 256)),
          event_name, COALESCE(configuration_version_id, ''), result_count_bucket,
          response_status, response_time_bucket, media_type, failure_category,
          feedback_category, source_surface, authenticated, COUNT(*),
          COUNT(DISTINCT recommendation_correlation_id)
        FROM product_analytics_events
        WHERE occurred_at >= ? AND occurred_at < ?
        GROUP BY event_name, COALESCE(configuration_version_id, ''), result_count_bucket,
          response_status, response_time_bucket, media_type, failure_category,
          feedback_category, source_surface, authenticated`,
        [aggregateDate, dayStart, dayEnd],
      );
      await connection.query(
        `INSERT INTO product_analytics_daily (
          aggregate_date, aggregate_key, event_name, configuration_version_id, result_count_bucket,
          response_status, response_time_bucket, media_type, failure_category,
          feedback_category, source_surface, authenticated, event_count, correlated_request_count
        )
        SELECT ?, UNHEX(SHA2(CONCAT_WS('|', 'helpful_recommendation_request', COALESCE(configuration_version_id, ''), 'none',
          'success', 'none', 'none', 'none', 'none', 'recommendations', 0), 256)),
          'helpful_recommendation_request', COALESCE(configuration_version_id, ''), 'none', 'success', 'none',
          'none', 'none', 'none', 'recommendations', 0,
          COUNT(DISTINCT recommendation_correlation_id), COUNT(DISTINCT recommendation_correlation_id)
        FROM product_analytics_events
        WHERE occurred_at >= ? AND occurred_at < ?
          AND recommendation_correlation_id IS NOT NULL
          AND (event_name = 'recommendation_saved'
            OR (event_name = 'recommendation_feedback' AND feedback_category = 'positive'))
        GROUP BY COALESCE(configuration_version_id, '')
        HAVING COUNT(DISTINCT recommendation_correlation_id) > 0`,
        [aggregateDate, dayStart, dayEnd],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteEventsBefore(before: Date, limit: number): Promise<number> {
    const boundedLimit = Math.max(1, Math.min(limit, 5000));
    const [result] = await this.pool.query(
      `DELETE FROM product_analytics_events WHERE occurred_at < ? ORDER BY occurred_at LIMIT ${boundedLimit}`,
      [before],
    );
    return (result as { affectedRows?: number }).affectedRows ?? 0;
  }

  async listDaily(startDate: string, endDate: string): Promise<ProductAnalyticsDailyRow[]> {
    const [rows] = await this.pool.query(
      `SELECT aggregate_date, event_name, configuration_version_id, result_count_bucket,
        response_status, response_time_bucket, media_type, failure_category,
        feedback_category, source_surface, authenticated, event_count, correlated_request_count
       FROM product_analytics_daily
       WHERE aggregate_date >= ? AND aggregate_date <= ?
       ORDER BY aggregate_date ASC, event_name ASC`,
      [startDate, endDate],
    );
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      aggregateDate: row.aggregate_date instanceof Date ? row.aggregate_date.toISOString().slice(0, 10) : String(row.aggregate_date),
      eventName: row.event_name as ProductAnalyticsDailyRow['eventName'],
      configurationVersionId: String(row.configuration_version_id || '') || null,
      resultCountBucket: String(row.result_count_bucket), responseStatus: String(row.response_status),
      responseTimeBucket: String(row.response_time_bucket), mediaType: String(row.media_type),
      failureCategory: String(row.failure_category), feedbackCategory: String(row.feedback_category),
      sourceSurface: String(row.source_surface), authenticated: Boolean(row.authenticated),
      eventCount: Number(row.event_count), correlatedRequestCount: Number(row.correlated_request_count),
    }));
  }
}
