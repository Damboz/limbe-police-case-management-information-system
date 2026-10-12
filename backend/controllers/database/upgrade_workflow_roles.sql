-- ============================================================
-- Limbe Police CMS - Workflow Roles Migration
--
-- Introduces the revised station workflow:
--   * New roles: Police Officer (7), Records Officer (8),
--     Station Officer (9), Branch Officer (10)
--   * Legacy users are remapped:
--       Counter/Intake Officer + Investigating Officer -> Police Officer
--       Station Commander -> Station Officer
--       Branch In-charge -> Branch Officer
--       Admin and Prosecutor are unchanged
--   * users.branch: workflow branch, required for Branch Officer
--   * cases: recorded_by/recorded_at replace intake_officer_id,
--     ob_number becomes nullable (assigned later by the Records
--     Officer), plus criminal_number, classification,
--     workflow_branch, classification and assignment audit columns
--   * New tables: case_assignments (assignment history),
--     case_file_movements (file movement log),
--     number_sequences (OB/CR yearly counters)
--   * Existing state is carried over:
--       - the lead investigator becomes cases.assigned_to
--       - investigated cases are classified from their
--         priority (High/Critical -> CID, else the
--         Investigation Branch)
--       - number_sequences counters start past the existing
--         OB numbers
--
-- Idempotent: safe to re-run against an existing database.
-- Run with: psql -U postgres -d limbe_police -f upgrade_workflow_roles.sql
-- ============================================================

\set ON_ERROR_STOP on

-- 1. New roles ------------------------------------------------------------
INSERT INTO roles (id, name, description) VALUES
(7,  'Police Officer',  'Records and registers cases; investigates assigned cases'),
(8,  'Records Officer', 'Assigns OB and criminal numbers to registered cases'),
(9,  'Station Officer', 'Classifies cases, reviews files, approves closure, forwards to prosecution'),
(10, 'Branch Officer',  'Assigns investigating officers within a workflow branch')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

SELECT setval(pg_get_serial_sequence('roles', 'id'), (SELECT MAX(id) FROM roles));

-- 2. Users: workflow branch + role remapping ------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch varchar(50) DEFAULT NULL;

-- The old CHECK only allows the legacy role names, so it
-- must be dropped before the remapping UPDATEs run.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;

UPDATE users SET role = 'Police Officer',  role_id = 7
WHERE role IN ('Counter/Intake Officer', 'officer', 'Investigating Officer', 'investigator');

UPDATE users SET role = 'Station Officer', role_id = 9
WHERE role IN ('Station Commander', 'supervisor');

UPDATE users SET role = 'Branch Officer',  role_id = 10
WHERE role IN ('Branch In-charge');

-- Branch Officers head a workflow branch. Legacy branch in-charges are
-- mapped from their operational branch: CID staff stay in CID, everyone
-- else lands in the Investigation Branch.
UPDATE users SET branch = 'Criminal Investigation Department'
WHERE role = 'Branch Officer'
  AND branch_id IN (SELECT id FROM station_branch WHERE code = 'CID');

UPDATE users SET branch = 'Investigation Branch'
WHERE role = 'Branch Officer' AND branch IS NULL;

ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN (
    'Admin', 'admin',
    'Police Officer', 'police officer',
    'Records Officer', 'records officer',
    'Station Officer', 'station officer',
    'Branch Officer', 'branch officer',
    'Prosecutor', 'prosecutor'
));

-- 3. Cases: workflow columns ----------------------------------------------
ALTER TABLE cases ADD COLUMN IF NOT EXISTS recorded_by int;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS recorded_at timestamptz DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS criminal_number varchar(50) DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS numbers_assigned_by int DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS numbers_assigned_at timestamptz DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS classification varchar(20) DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS workflow_branch varchar(50) DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS classified_by int DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS classified_at timestamptz DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_to int DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_by int DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_at timestamptz DEFAULT NULL;

-- The recording officer replaces the intake officer concept. The column
-- rename only runs once; on re-run the column is already gone.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'cases'::regclass
          AND attname = 'intake_officer_id'
          AND NOT attisdropped
    ) THEN
        UPDATE cases
        SET recorded_by = intake_officer_id, recorded_at = created_at
        WHERE recorded_by IS NULL AND intake_officer_id IS NOT NULL;

        ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_ibfk_3;
        ALTER TABLE cases DROP COLUMN intake_officer_id;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_case_recorded_by') THEN
        ALTER TABLE cases ADD CONSTRAINT fk_case_recorded_by
            FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_case_numbers_assigned_by') THEN
        ALTER TABLE cases ADD CONSTRAINT fk_case_numbers_assigned_by
            FOREIGN KEY (numbers_assigned_by) REFERENCES users (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_case_classified_by') THEN
        ALTER TABLE cases ADD CONSTRAINT fk_case_classified_by
            FOREIGN KEY (classified_by) REFERENCES users (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_case_assigned_to') THEN
        ALTER TABLE cases ADD CONSTRAINT fk_case_assigned_to
            FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_case_assigned_by') THEN
        ALTER TABLE cases ADD CONSTRAINT fk_case_assigned_by
            FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_cases_criminal_number') THEN
        ALTER TABLE cases ADD CONSTRAINT uq_cases_criminal_number UNIQUE (criminal_number);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_classification') THEN
        ALTER TABLE cases ADD CONSTRAINT chk_cases_classification
            CHECK (classification IS NULL OR classification IN ('Minor', 'Medium', 'High', 'Critical'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_workflow_branch') THEN
        ALTER TABLE cases ADD CONSTRAINT chk_cases_workflow_branch
            CHECK (workflow_branch IS NULL OR workflow_branch IN ('Investigation Branch', 'Criminal Investigation Department'));
    END IF;
END $$;

-- Migrate workflow branch values recorded under the old
-- 'CID' abbreviation to the full branch name.
UPDATE users SET branch = 'Criminal Investigation Department' WHERE branch = 'CID';
UPDATE cases SET workflow_branch = 'Criminal Investigation Department' WHERE workflow_branch = 'CID';

-- 4. Case lifecycle --------------------------------------------------------
-- The old CHECK only allows the legacy statuses, so it
-- must be dropped before the status UPDATEs run.
ALTER TABLE cases DROP CONSTRAINT IF EXISTS chk_cases_status;

-- Every existing case already has an OB number, so every existing case is
-- past the numbering stage: 'Reported' becomes 'Numbered' (awaiting
-- classification), and cases with a completion request pending branch
-- review become 'Submitted for Review'. Terminal states are kept.
UPDATE cases SET status = 'Numbered' WHERE status = 'Reported';

UPDATE cases SET status = 'Submitted for Review'
WHERE branch_review_status = 'Pending Review' AND requested_status IS NOT NULL;

-- New cases are created without an OB number; the Records Officer
-- assigns it later. PostgreSQL UNIQUE allows multiple NULLs.
ALTER TABLE cases ALTER COLUMN ob_number DROP NOT NULL;

ALTER TABLE cases ADD CONSTRAINT chk_cases_status CHECK (status IN (
    'Registered', 'Numbered', 'Classified', 'Assigned', 'Under Investigation',
    'Submitted for Review', 'Court Pending', 'Forwarded to Prosecution',
    'Closed', 'Archived'
));

-- 5. Minutes: new review step ---------------------------------------------
ALTER TABLE case_minutes DROP CONSTRAINT IF EXISTS chk_minutes_type;
ALTER TABLE case_minutes ADD CONSTRAINT chk_minutes_type CHECK (minute_type IN (
    'BRANCH_REVIEW', 'COMMANDER_APPROVAL', 'PROSECUTOR_QUERY', 'STATION_REVIEW'
));

ALTER TABLE case_minutes DROP CONSTRAINT IF EXISTS chk_minutes_decision;
ALTER TABLE case_minutes ADD CONSTRAINT chk_minutes_decision CHECK (decision IN (
    'Recommended', 'Returned', 'Approved', 'Rejected', 'Query', 'Forwarded'
));

-- 6. Assignment history ----------------------------------------------------
CREATE TABLE IF NOT EXISTS case_assignments (
    id          SERIAL PRIMARY KEY,
    case_id     int NOT NULL,
    assigned_to int NOT NULL,
    assigned_by int DEFAULT NULL,
    reason      text,
    created_at  timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assignments_case   FOREIGN KEY (case_id)     REFERENCES cases (id) ON DELETE CASCADE,
    CONSTRAINT fk_assignments_target FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_assignments_by     FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_case_assignments_case   ON case_assignments (case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_target ON case_assignments (assigned_to);

-- Seed the history from the current assignment table.
INSERT INTO case_assignments (case_id, assigned_to, assigned_by, created_at)
SELECT ci.case_id, ci.investigator_id, ci.assigned_by, ci.assigned_at
FROM case_investigators ci
WHERE NOT EXISTS (
    SELECT 1 FROM case_assignments ca
    WHERE ca.case_id = ci.case_id AND ca.assigned_to = ci.investigator_id
);

-- 7. File movement log -----------------------------------------------------
CREATE TABLE IF NOT EXISTS case_file_movements (
    id             SERIAL PRIMARY KEY,
    case_id        int NOT NULL,
    handed_over_by int NOT NULL,
    received_by    int NOT NULL,
    moved_at       timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
    notes          text,
    CONSTRAINT fk_movements_case FOREIGN KEY (case_id)        REFERENCES cases (id) ON DELETE CASCADE,
    CONSTRAINT fk_movements_from FOREIGN KEY (handed_over_by) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_movements_to   FOREIGN KEY (received_by)    REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_case_file_movements_case ON case_file_movements (case_id);

-- 8. OB / criminal number sequences ---------------------------------------
-- The Records Officer's numbering service draws from these counters,
-- one per year and type ('OB' and 'CR'), so numbers never collide.
CREATE TABLE IF NOT EXISTS number_sequences (
    year        int NOT NULL,
    type        varchar(10) NOT NULL,
    last_number int NOT NULL DEFAULT 0,
    updated_at  timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (year, type),
    CONSTRAINT chk_number_type CHECK (type IN ('OB', 'CR'))
);

-- 9. Carry existing case state over --------------------------------
-- Cases that are already under investigation keep their
-- investigator: the lead investigator becomes the case
-- assignee, mirroring the assignment history seeded above.
UPDATE cases c
SET assigned_to = ci.investigator_id,
    assigned_by = ci.assigned_by,
    assigned_at = ci.assigned_at
FROM (
    SELECT DISTINCT ON (case_id)
        case_id, investigator_id, assigned_by, assigned_at
    FROM case_investigators
    ORDER BY case_id, is_lead DESC, assigned_at ASC
) ci
WHERE ci.case_id = c.id
  AND c.assigned_to IS NULL;

-- Cases that were already investigated had a classification
-- under the old workflow: their priority becomes the
-- classification, and the workflow branch follows the
-- classification rule (High/Critical -> CID, otherwise the
-- Investigation Branch). Cases that were only reported stay
-- unclassified ('Numbered', awaiting the Station Officer).
UPDATE cases
SET classification = CASE priority WHEN 'Low' THEN 'Minor' ELSE priority END,
    workflow_branch = CASE
        WHEN priority IN ('High', 'Critical') THEN 'Criminal Investigation Department'
        ELSE 'Investigation Branch'
    END
WHERE classification IS NULL
  AND status <> 'Numbered';

-- Numbering continues past the existing OB numbers: one
-- counter per year, seeded with the count of existing
-- numbers (legacy format OB-YYYYMMDD-NNNN).
INSERT INTO number_sequences (year, type, last_number)
SELECT CAST(substring(ob_number FROM 4 FOR 4) AS int), 'OB', COUNT(*)
FROM cases
WHERE ob_number ~ '^OB-[0-9]{4}'
GROUP BY 1
ON CONFLICT (year, type) DO UPDATE
SET last_number = GREATEST(number_sequences.last_number, EXCLUDED.last_number);
