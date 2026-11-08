-- ============================================================
-- Registration, branch assignment and SMS migration
--
-- Retires the Records Officer role, moves OB/CR numbering into
-- registration, adds assignment history metadata and an SMS log,
-- then rewrites every existing OB/CR number to the new formats.
--
-- Safe to run more than once. The script opens and commits its own
-- transaction, so a failure leaves the station's data untouched:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-11-06_registration_branch_sms.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Phone numbers (older databases may predate this column).
-- ------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_number varchar(20) DEFAULT NULL;

-- ------------------------------------------------------------
-- 2. Retire the Records Officer role.
--    The role lookup row is kept for history; its holders become
--    Police Officers because numbering now happens at registration.
-- ------------------------------------------------------------
UPDATE users
SET role = 'Police Officer',
    role_id = 7,
    updated_at = NOW()
WHERE role IN ('Records Officer', 'records officer') OR role_id = 8;

UPDATE roles
SET description = 'Retired role: numbering and register duties merged into Police Officer'
WHERE id = 8;

-- ------------------------------------------------------------
-- 3. Classification and branch columns (idempotent for old DBs).
-- ------------------------------------------------------------
ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS classification varchar(20) DEFAULT NULL;

ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS workflow_branch varchar(50) DEFAULT NULL;

-- Derive classification, workflow branch and legacy branch_id from
-- the offence category's severity for any case that is missing them.
UPDATE cases c
SET classification = CASE cc.severity_level
        WHEN 'Minor' THEN 'Minor'
        WHEN 'Moderate' THEN 'Medium'
        WHEN 'Severe' THEN 'High'
        WHEN 'Critical' THEN 'Critical'
    END,
    workflow_branch = CASE
        WHEN cc.severity_level IN ('Severe', 'Critical') THEN 'Criminal Investigation Department'
        ELSE 'Investigation Branch'
    END,
    classified_by = COALESCE(c.classified_by, c.recorded_by),
    classified_at = COALESCE(c.classified_at, c.created_at, NOW()),
    updated_at = NOW()
FROM crime_categories cc
WHERE c.category_id = cc.id
  AND (c.classification IS NULL OR c.workflow_branch IS NULL);

UPDATE cases c
SET branch_id = b.id,
    updated_at = NOW()
FROM crime_categories cc
JOIN station_branch b ON b.code = CASE
        WHEN cc.severity_level IN ('Severe', 'Critical') THEN 'CID'
        ELSE 'INV'
    END
WHERE c.category_id = cc.id
  AND c.branch_id IS DISTINCT FROM b.id;

-- ------------------------------------------------------------
-- 4. Assignment history: role type, status, notes and timestamp.
-- ------------------------------------------------------------
ALTER TABLE case_assignments
    ADD COLUMN IF NOT EXISTS role_type varchar(40) NOT NULL DEFAULT 'Investigator';

ALTER TABLE case_assignments
    ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'Active';

ALTER TABLE case_assignments
    ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE case_assignments
    ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_case_assignments_role_type'
    ) THEN
        ALTER TABLE case_assignments
            ADD CONSTRAINT chk_case_assignments_role_type
            CHECK (role_type IN ('Investigator', 'Court Standing Officer'));
    END IF;
END $$;

UPDATE case_assignments
SET assigned_at = COALESCE(assigned_at, created_at, NOW()),
    notes = COALESCE(notes, reason),
    role_type = COALESCE(NULLIF(role_type, ''), 'Investigator'),
    status = COALESCE(NULLIF(status, ''), 'Active')
WHERE assigned_at IS NULL
   OR notes IS NULL
   OR role_type IS NULL
   OR role_type = ''
   OR status IS NULL
   OR status = '';

CREATE INDEX IF NOT EXISTS idx_case_assignments_role
    ON case_assignments (case_id, role_type, status);

-- Seed history rows from the current investigator table so every
-- active investigator has a matching assignment record.
INSERT INTO case_assignments
    (case_id, assigned_to, assigned_by, reason, role_type, status, notes, assigned_at, created_at)
SELECT ci.case_id,
       ci.investigator_id,
       ci.assigned_by,
       NULL,
       'Investigator',
       'Active',
       NULL,
       ci.assigned_at,
       COALESCE(ci.assigned_at, NOW())
FROM case_investigators ci
WHERE NOT EXISTS (
    SELECT 1
    FROM case_assignments ca
    WHERE ca.case_id = ci.case_id
      AND ca.assigned_to = ci.investigator_id
      AND ca.role_type = 'Investigator'
);

-- ------------------------------------------------------------
-- 5. SMS notifications (TextBee).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_notifications (
    id         SERIAL PRIMARY KEY,
    case_id    int NOT NULL,
    officer_id int NOT NULL,
    role       varchar(40) NOT NULL,
    phone      varchar(30) DEFAULT NULL,
    message    text,
    status     varchar(10) NOT NULL DEFAULT 'PENDING',
    error      text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at    timestamptz DEFAULT NULL,
    CONSTRAINT fk_sms_notifications_case FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE,
    CONSTRAINT fk_sms_notifications_officer FOREIGN KEY (officer_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_sms_notifications_status CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_sms_notifications_case ON sms_notifications (case_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_officer ON sms_notifications (officer_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_created ON sms_notifications (created_at);

-- ------------------------------------------------------------
-- 6. Rewrite every OB/CR number to the new formats.
--    OB/0001/2026 and CR/LIMBE/2026/0001, sequential per year.
--    The rewrite is deterministic (creation order, then id) so
--    running this file again produces the same values.
-- ------------------------------------------------------------
CREATE TEMP TABLE _case_number_rewrite ON COMMIT DROP AS
WITH base AS (
    SELECT
        c.id,
        c.created_at,
        COALESCE(
            CASE WHEN c.ob_number ~ '^OB/[0-9]{4}/[0-9]{4}$'
                 THEN split_part(c.ob_number, '/', 3)::int END,
            CASE WHEN c.criminal_number ~ '^CR/LIMBE/[0-9]{4}/[0-9]{4}$'
                 THEN split_part(c.criminal_number, '/', 3)::int END,
            NULLIF(substring(c.ob_number FROM '([0-9]{4})'), '')::int,
            NULLIF(substring(c.criminal_number FROM '([0-9]{4})'), '')::int,
            EXTRACT(YEAR FROM COALESCE(c.created_at, CURRENT_TIMESTAMP))::int
        ) AS year
    FROM cases c
    -- Pending online complaints are not yet cases: they must keep their
    -- placeholder numbers until a police officer approves them.
    WHERE NOT (c.source = 'Online' AND c.complaint_status = 'Pending')
), numbered AS (
    SELECT
        id,
        year,
        ROW_NUMBER() OVER (
            PARTITION BY year
            ORDER BY created_at NULLS LAST, id
        ) AS seq
    FROM base
)
SELECT
    id,
    year,
    seq,
    'OB/' || lpad(seq::text, 4, '0') || '/' || year AS new_ob,
    'CR/LIMBE/' || year || '/' || lpad(seq::text, 4, '0') AS new_cr
FROM numbered;

-- Two phases avoid colliding with the UNIQUE constraints while the
-- old and new values temporarily coexist.
UPDATE cases c
SET ob_number = 'TMP-OB-' || c.id,
    criminal_number = 'TMP-CR-' || c.id
WHERE EXISTS (SELECT 1 FROM _case_number_rewrite r WHERE r.id = c.id);

UPDATE cases c
SET ob_number = r.new_ob,
    criminal_number = r.new_cr,
    numbers_assigned_by = COALESCE(c.numbers_assigned_by, c.recorded_by),
    numbers_assigned_at = COALESCE(c.numbers_assigned_at, c.created_at, NOW()),
    status = CASE
        WHEN c.status = 'Registered' AND COALESCE(c.complaint_status, 'Approved') = 'Approved'
            THEN 'Classified'
        ELSE c.status
    END,
    updated_at = NOW()
FROM _case_number_rewrite r
WHERE c.id = r.id;

-- Move the yearly counters past the highest rewritten sequence.
INSERT INTO number_sequences (year, type, last_number, updated_at)
SELECT year, 'OB', MAX(seq), NOW()
FROM _case_number_rewrite
GROUP BY year
ON CONFLICT (year, type)
DO UPDATE SET last_number = GREATEST(number_sequences.last_number, EXCLUDED.last_number),
              updated_at = NOW();

INSERT INTO number_sequences (year, type, last_number, updated_at)
SELECT year, 'CR', MAX(seq), NOW()
FROM _case_number_rewrite
GROUP BY year
ON CONFLICT (year, type)
DO UPDATE SET last_number = GREATEST(number_sequences.last_number, EXCLUDED.last_number),
              updated_at = NOW();

-- ------------------------------------------------------------
-- 7. Verification report.
-- ------------------------------------------------------------
SELECT 'users still holding Records Officer' AS check_name,
       COUNT(*) AS value
FROM users
WHERE role IN ('Records Officer', 'records officer') OR role_id = 8;

SELECT 'cases missing OB number' AS check_name, COUNT(*) AS value
FROM cases WHERE ob_number IS NULL;

SELECT 'cases missing criminal number' AS check_name, COUNT(*) AS value
FROM cases WHERE criminal_number IS NULL;

SELECT 'cases missing classification' AS check_name, COUNT(*) AS value
FROM cases WHERE classification IS NULL;

SELECT 'cases missing workflow branch' AS check_name, COUNT(*) AS value
FROM cases WHERE workflow_branch IS NULL;

SELECT 'active assignment rows' AS check_name, COUNT(*) AS value
FROM case_assignments WHERE status = 'Active';

SELECT 'sms_notifications rows' AS check_name, COUNT(*) AS value
FROM sms_notifications;

SELECT type, year, last_number
FROM number_sequences
ORDER BY year, type;

COMMIT;
