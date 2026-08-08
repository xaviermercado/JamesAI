-- Migration 0009: Add privacy-minimized product analytics and daily aggregates.
-- Raw events intentionally contain no user ID, IP, user agent, URL, title, prompt, or free-text payload.

CREATE TABLE product_analytics_events (
  event_id CHAR(36) NOT NULL,
  recommendation_correlation_id CHAR(36) NULL,
  event_name ENUM(
    'recommendation_requested', 'recommendation_completed', 'recommendation_failed',
    'recommendation_opened', 'recommendation_saved', 'recommendation_feedback',
    'letterboxd_sync_completed', 'letterboxd_sync_failed', 'registration_completed',
    'verification_email_succeeded', 'verification_email_failed',
    'contact_submission_succeeded', 'contact_submission_failed'
  ) NOT NULL,
  occurred_at DATETIME NOT NULL,
  configuration_version_id VARCHAR(64) NULL,
  result_count_bucket ENUM('none', '0', '1_5', '6_10', '11_20', '21_plus') NOT NULL DEFAULT 'none',
  response_status ENUM('none', 'success', 'empty', 'failure') NOT NULL DEFAULT 'none',
  response_time_bucket ENUM('none', 'under_1s', '1_3s', '3_10s', 'over_10s') NOT NULL DEFAULT 'none',
  media_type ENUM('none', 'movie', 'tv') NOT NULL DEFAULT 'none',
  genre_filter_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  provider_filter_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  language_filter_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  authenticated TINYINT(1) NOT NULL DEFAULT 0,
  failure_category ENUM(
    'none', 'validation', 'no_results', 'ai_provider', 'metadata_provider',
    'availability_provider', 'timeout', 'rate_limited', 'email_provider',
    'letterboxd_feed', 'database', 'unknown'
  ) NOT NULL DEFAULT 'none',
  feedback_category ENUM('none', 'positive', 'negative', 'already_watched') NOT NULL DEFAULT 'none',
  source_surface ENUM('none', 'recommendations', 'library', 'profile', 'auth', 'contact') NOT NULL DEFAULT 'none',
  PRIMARY KEY (event_id),
  KEY idx_product_analytics_occurred_event (occurred_at, event_name),
  KEY idx_product_analytics_correlation (recommendation_correlation_id, event_name),
  CONSTRAINT chk_product_analytics_filter_counts CHECK (
    genre_filter_count <= 20 AND provider_filter_count <= 20 AND language_filter_count <= 20
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_analytics_daily (
  daily_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aggregate_date DATE NOT NULL,
  aggregate_key BINARY(32) NOT NULL,
  event_name VARCHAR(64) NOT NULL,
  configuration_version_id VARCHAR(64) NOT NULL DEFAULT '',
  result_count_bucket VARCHAR(16) NOT NULL DEFAULT 'none',
  response_status VARCHAR(16) NOT NULL DEFAULT 'none',
  response_time_bucket VARCHAR(16) NOT NULL DEFAULT 'none',
  media_type VARCHAR(16) NOT NULL DEFAULT 'none',
  failure_category VARCHAR(32) NOT NULL DEFAULT 'none',
  feedback_category VARCHAR(24) NOT NULL DEFAULT 'none',
  source_surface VARCHAR(24) NOT NULL DEFAULT 'none',
  authenticated TINYINT(1) NOT NULL DEFAULT 0,
  event_count INT UNSIGNED NOT NULL,
  correlated_request_count INT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (daily_id),
  UNIQUE KEY uq_product_analytics_daily_dimensions (aggregate_date, aggregate_key),
  KEY idx_product_analytics_daily_reporting (aggregate_date, event_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback notes (run manually if needed):
--   DROP TABLE IF EXISTS product_analytics_daily;
--   DROP TABLE IF EXISTS product_analytics_events;
