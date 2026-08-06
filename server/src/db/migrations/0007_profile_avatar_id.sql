-- Migration 0007: Add stable Scouty avatar ID field to profiles.
-- Safe defaults: existing rows remain unchanged and resolve to app default at read time.

ALTER TABLE profiles
  ADD COLUMN avatar_id VARCHAR(32) NULL AFTER avatar_url;

-- Rollback notes (run manually if needed):
--   ALTER TABLE profiles DROP COLUMN avatar_id;
