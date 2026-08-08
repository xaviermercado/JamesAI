-- Migration 0008: Add privacy-conscious Letterboxd integration storage.
-- Uses user-controlled public RSS snapshots and optional imported history.

CREATE TABLE user_letterboxd_settings (
  user_id CHAR(36) NOT NULL,
  public_activity_enabled TINYINT(1) NOT NULL DEFAULT 0,
  rss_status ENUM('idle', 'ok', 'error') NOT NULL DEFAULT 'idle',
  rss_last_checked_at DATETIME(3) NULL,
  rss_last_success_at DATETIME(3) NULL,
  rss_last_error_code VARCHAR(64) NULL,
  rss_last_error_message VARCHAR(255) NULL,
  rss_etag VARCHAR(255) NULL,
  rss_last_modified VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_letterboxd_settings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_letterboxd_seen_titles (
  user_letterboxd_seen_title_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  source ENUM('rss', 'export') NOT NULL,
  normalized_title VARCHAR(255) NOT NULL,
  release_year SMALLINT UNSIGNED NULL,
  watched_at DATETIME(3) NULL,
  is_rewatch TINYINT(1) NOT NULL DEFAULT 0,
  rating_tenths TINYINT UNSIGNED NULL,
  liked TINYINT(1) NOT NULL DEFAULT 0,
  raw_title VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_letterboxd_seen_title_id),
  KEY idx_letterboxd_seen_titles_user_source (user_id, source),
  KEY idx_letterboxd_seen_titles_user_title (user_id, normalized_title, release_year),
  CONSTRAINT fk_user_letterboxd_seen_titles_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback notes (run manually if needed):
--   DROP TABLE IF EXISTS user_letterboxd_seen_titles;
--   DROP TABLE IF EXISTS user_letterboxd_settings;