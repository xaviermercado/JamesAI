CREATE TABLE users (
  user_id CHAR(36) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified_at DATETIME(3) NULL,
  account_status ENUM('pending_verification', 'active', 'disabled') NOT NULL DEFAULT 'pending_verification',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_account_status_email (account_status, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_sessions (
  session_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_used_at DATETIME(3) NULL,
  device_label VARCHAR(120) NULL,
  client_platform ENUM('web', 'ios', 'android', 'unknown') NOT NULL DEFAULT 'web',
  PRIMARY KEY (session_id),
  UNIQUE KEY uq_user_sessions_token_hash (token_hash),
  KEY idx_user_sessions_user_id (user_id),
  KEY idx_user_sessions_active_lookup (token_hash, revoked_at, expires_at),
  KEY idx_user_sessions_cleanup (expires_at, revoked_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_verification_tokens (
  token_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token_id),
  UNIQUE KEY uq_email_verification_tokens_token_hash (token_hash),
  KEY idx_email_verification_tokens_user_id (user_id),
  KEY idx_email_verification_tokens_cleanup (expires_at, used_at),
  CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
  token_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token_id),
  UNIQUE KEY uq_password_reset_tokens_token_hash (token_hash),
  KEY idx_password_reset_tokens_user_id (user_id),
  KEY idx_password_reset_tokens_cleanup (expires_at, used_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE profiles (
  user_id CHAR(36) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  country_code CHAR(2) NOT NULL,
  avatar_url VARCHAR(2048) NULL,
  letterboxd_username VARCHAR(100) NULL,
  letterboxd_profile_url VARCHAR(2048) NULL,
  tvtime_username VARCHAR(100) NULL,
  tvtime_profile_url VARCHAR(2048) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  KEY idx_profiles_country_code (country_code),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_streaming_services (
  user_streaming_service_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  tmdb_provider_id INT UNSIGNED NOT NULL,
  provider_name VARCHAR(255) NOT NULL,
  logo_path VARCHAR(255) NULL,
  country_code CHAR(2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_streaming_service_id),
  UNIQUE KEY uq_user_streaming_services_user_provider_country (user_id, tmdb_provider_id, country_code),
  KEY idx_user_streaming_services_user_id (user_id),
  KEY idx_user_streaming_services_provider_lookup (country_code, tmdb_provider_id),
  CONSTRAINT fk_user_streaming_services_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_title_feedback (
  user_title_feedback_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  tmdb_id INT UNSIGNED NOT NULL,
  media_type ENUM('movie', 'tv') NOT NULL,
  feedback_type ENUM('liked', 'disliked', 'watched') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_title_feedback_id),
  UNIQUE KEY uq_user_title_feedback (user_id, tmdb_id, media_type),
  KEY idx_user_title_feedback_user_id (user_id),
  KEY idx_user_title_feedback_exclusions (user_id, media_type, feedback_type, tmdb_id),
  CONSTRAINT fk_user_title_feedback_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
