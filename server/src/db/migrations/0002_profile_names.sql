ALTER TABLE profiles
  ADD COLUMN first_name VARCHAR(80) NULL AFTER user_id,
  ADD COLUMN last_name VARCHAR(80) NULL AFTER first_name;