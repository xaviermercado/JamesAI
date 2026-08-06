-- Migration 0004: Add personalization toggle to profiles and cache metadata to user_title_feedback.
-- Safe defaults: existing rows gain NULL/truthy values; no data is lost.

ALTER TABLE profiles
  ADD COLUMN personalization_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER viewing_format_preference;

ALTER TABLE user_title_feedback
  ADD COLUMN genres_json VARCHAR(500) NULL AFTER feedback_type,
  ADD COLUMN original_language CHAR(10) NULL AFTER genres_json;

-- Rollback notes (run manually if needed):
--   ALTER TABLE profiles DROP COLUMN personalization_enabled;
--   ALTER TABLE user_title_feedback DROP COLUMN genres_json, DROP COLUMN original_language;
