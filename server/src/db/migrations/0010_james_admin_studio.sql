ALTER TABLE users
  ADD COLUMN admin_role ENUM('user', 'editor', 'owner') NOT NULL DEFAULT 'user' AFTER account_status,
  ADD INDEX idx_users_admin_role (admin_role, account_status);

ALTER TABLE user_sessions
  ADD COLUMN authenticated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER created_at;

CREATE TABLE james_configurations (
  configuration_id CHAR(36) NOT NULL,
  version_number BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  status ENUM('draft', 'published', 'superseded') NOT NULL DEFAULT 'draft',
  schema_version SMALLINT UNSIGNED NOT NULL,
  configuration_json JSON NOT NULL,
  configuration_hash CHAR(64) NOT NULL,
  change_reason VARCHAR(240) NULL,
  validation_status ENUM('pending', 'valid', 'invalid') NOT NULL DEFAULT 'pending',
  validation_errors_json JSON NULL,
  validated_at DATETIME(3) NULL,
  source_configuration_id CHAR(36) NULL,
  created_by_user_id CHAR(36) NULL,
  updated_by_user_id CHAR(36) NULL,
  published_by_user_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  published_at DATETIME(3) NULL,
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (configuration_id),
  UNIQUE KEY uq_james_configurations_version (version_number),
  KEY idx_james_configurations_status_updated (status, updated_at),
  KEY idx_james_configurations_source (source_configuration_id),
  CONSTRAINT fk_james_configurations_source
    FOREIGN KEY (source_configuration_id) REFERENCES james_configurations(configuration_id) ON DELETE RESTRICT,
  CONSTRAINT fk_james_configurations_creator
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_james_configurations_updater
    FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_james_configurations_publisher
    FOREIGN KEY (published_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE james_configuration_active (
  singleton_id TINYINT UNSIGNED NOT NULL,
  configuration_id CHAR(36) NULL,
  activated_at DATETIME(3) NULL,
  PRIMARY KEY (singleton_id),
  UNIQUE KEY uq_james_configuration_active_version (configuration_id),
  CONSTRAINT chk_james_configuration_active_singleton CHECK (singleton_id = 1),
  CONSTRAINT fk_james_configuration_active_version
    FOREIGN KEY (configuration_id) REFERENCES james_configurations(configuration_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO james_configuration_active (singleton_id, configuration_id, activated_at)
VALUES (1, NULL, NULL);

CREATE TABLE james_admin_audit_log (
  audit_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  action ENUM(
    'draft_created',
    'draft_saved',
    'draft_validated',
    'sandbox_executed',
    'configuration_published',
    'configuration_rolled_back',
    'feedback_categorized',
    'admin_role_changed',
    'sensitive_action_denied'
  ) NOT NULL,
  target_type ENUM('configuration', 'feedback', 'administrator', 'sandbox', 'authorization') NOT NULL,
  target_id VARCHAR(64) NULL,
  outcome ENUM('succeeded', 'failed', 'denied') NOT NULL,
  summary_json JSON NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (audit_id),
  KEY idx_james_admin_audit_occurred (occurred_at, audit_id),
  KEY idx_james_admin_audit_actor (actor_user_id, occurred_at),
  KEY idx_james_admin_audit_target (target_type, target_id, occurred_at),
  CONSTRAINT fk_james_admin_audit_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE james_feedback_reviews (
  review_id CHAR(36) NOT NULL,
  analytics_event_id CHAR(36) NOT NULL,
  category ENUM(
    'bad_match',
    'already_watched',
    'not_available',
    'too_repetitive',
    'content_restriction_problem',
    'good_recommendation',
    'technical_problem'
  ) NOT NULL,
  categorized_by_user_id CHAR(36) NOT NULL,
  categorized_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (review_id),
  UNIQUE KEY uq_james_feedback_reviews_event (analytics_event_id),
  KEY idx_james_feedback_reviews_category (category, categorized_at),
  CONSTRAINT fk_james_feedback_reviews_actor
    FOREIGN KEY (categorized_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;