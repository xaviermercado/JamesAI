-- Migration 0003: Add content-language preferences and viewing-format preference to profiles.
-- Safe defaults: existing rows gain NULL values; no data is lost.

ALTER TABLE profiles
  ADD COLUMN viewing_format_preference ENUM('no_preference', 'subtitles_ok', 'prefer_dubbed') NULL AFTER country_code;

CREATE TABLE user_content_languages (
  user_content_language_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_content_language_id),
  UNIQUE KEY uq_user_content_languages (user_id, language_code),
  KEY idx_user_content_languages_user_id (user_id),
  KEY idx_user_content_languages_sort (user_id, sort_order),
  CONSTRAINT fk_user_content_languages_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback notes (run manually if needed):
--   ALTER TABLE profiles DROP COLUMN viewing_format_preference;
--   DROP TABLE IF EXISTS user_content_languages;
