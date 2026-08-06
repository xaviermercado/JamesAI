-- Migration 0006: Add deterministic provider priority ordering for user_streaming_services.
-- Safe defaults: existing selections get stable fallback order by created_at.

ALTER TABLE user_streaming_services
  ADD COLUMN sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER country_code;

SET @rownum := -1;
UPDATE user_streaming_services
SET sort_order = (@rownum := @rownum + 1)
ORDER BY user_id ASC, created_at ASC, tmdb_provider_id ASC;

ALTER TABLE user_streaming_services
  ADD KEY idx_user_streaming_services_user_sort (user_id, sort_order);

-- Rollback notes (run manually if needed):
--   ALTER TABLE user_streaming_services DROP KEY idx_user_streaming_services_user_sort;
--   ALTER TABLE user_streaming_services DROP COLUMN sort_order;
