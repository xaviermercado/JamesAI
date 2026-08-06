-- Migration 0005: Add private user library for watchlist and watched title state.
-- State model is explicit and bounded per user/title/media identity.

CREATE TABLE user_library_titles (
  user_library_title_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  tmdb_id INT UNSIGNED NOT NULL,
  media_type ENUM('movie', 'tv') NOT NULL,
  library_status ENUM('watchlist', 'watched') NOT NULL,
  added_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  watched_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_library_title_id),
  UNIQUE KEY uq_user_library_title (user_id, tmdb_id, media_type),
  KEY idx_user_library_status_updated (user_id, library_status, updated_at),
  KEY idx_user_library_media_status_updated (user_id, media_type, library_status, updated_at),
  CONSTRAINT fk_user_library_titles_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback notes (run manually if needed):
--   DROP TABLE IF EXISTS user_library_titles;
