-- ============================================================
-- Limbe Police CMS - Court Forwarding Upgrade
-- Adds the officer assigned to stand with a case in court and
-- allows the prosecutor to record the court-forwarding minute.
-- Run against an existing database with:
--   psql -U postgres -d limbe_police -f upgrade_court_forwarding.sql
-- ============================================================

ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_officer_id int DEFAULT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_case_court_officer') THEN
        ALTER TABLE cases ADD CONSTRAINT fk_case_court_officer FOREIGN KEY (court_officer_id)
            REFERENCES users (id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cases_court_officer ON cases (court_officer_id);

-- The prosecutor's court-forwarding minute uses the existing
-- STATION_REVIEW / Forwarded values. Re-assert the constraints
-- so databases created by the older prosecution upgrade accept it.
ALTER TABLE case_minutes DROP CONSTRAINT IF EXISTS chk_minutes_type;
ALTER TABLE case_minutes ADD CONSTRAINT chk_minutes_type CHECK (minute_type IN (
    'BRANCH_REVIEW', 'COMMANDER_APPROVAL', 'PROSECUTOR_QUERY', 'STATION_REVIEW'
));

ALTER TABLE case_minutes DROP CONSTRAINT IF EXISTS chk_minutes_decision;
ALTER TABLE case_minutes ADD CONSTRAINT chk_minutes_decision CHECK (decision IN (
    'Recommended', 'Returned', 'Approved', 'Rejected', 'Query', 'Forwarded'
));
