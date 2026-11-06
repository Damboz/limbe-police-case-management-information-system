ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz NULL;

UPDATE users
SET failed_login_attempts = 0, locked_until = NULL
WHERE failed_login_attempts <> 0 OR locked_until IS NOT NULL;
