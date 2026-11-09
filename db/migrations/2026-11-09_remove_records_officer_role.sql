-- ============================================================
-- Remove the retired Records Officer role
--
-- The role was retired in 2026-11-06_registration_branch_sms.sql
-- (holders were remapped to Police Officer). This migration
-- finishes the job: any lingering holders are remapped, the
-- role row is deleted, and the users.role CHECK constraint no
-- longer accepts the retired name.
--
-- Safe to run more than once:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-11-09_remove_records_officer_role.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Remap any lingering holders to Police Officer.
-- ------------------------------------------------------------
UPDATE users
SET role = 'Police Officer',
    role_id = 7,
    updated_at = NOW()
WHERE role IN ('Records Officer', 'records officer') OR role_id = 8;

-- ------------------------------------------------------------
-- 2. Drop the retired role row.
-- ------------------------------------------------------------
DELETE FROM roles WHERE id = 8;

-- ------------------------------------------------------------
-- 3. Remove the retired name from the role CHECK constraint.
-- ------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN (
    'Admin', 'admin',
    'Police Officer', 'police officer',
    'Station Officer', 'station officer',
    'Branch Officer', 'branch officer',
    'Prosecutor', 'prosecutor'
));

-- ------------------------------------------------------------
-- 4. Verification.
-- ------------------------------------------------------------
SELECT 'roles still named Records Officer' AS check_name,
       COUNT(*) AS remaining
FROM roles
WHERE id = 8 OR name IN ('Records Officer', 'records officer');

SELECT 'users still holding Records Officer' AS check_name,
       COUNT(*) AS remaining
FROM users
WHERE role IN ('Records Officer', 'records officer') OR role_id = 8;

COMMIT;
