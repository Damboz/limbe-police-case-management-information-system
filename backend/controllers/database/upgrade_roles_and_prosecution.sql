-- ============================================================
-- Limbe Police CMS - Incremental Upgrade
-- Adds the "Branch In-charge" and "Prosecutor" roles and the
-- branch-review / prosecution handover workflow to an EXISTING
-- database (idempotent). Run with: psql -U postgres -d limbe_police -f ...
-- ============================================================

-- 1. Roles
INSERT INTO roles (id, name, description) VALUES
(5, 'Branch In-charge', 'Branch Quality Control, Review Minutes, and Completion Sign-off'),
(6, 'Prosecutor',       'Receives Forwarded Files, Court Preparation, and Physical File Custody')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('roles', 'id'), (SELECT MAX(id) FROM roles));

-- 2. Users role CHECK - allow the new role strings
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN (
    'Admin', 'admin', 'Station Commander', 'supervisor',
    'Investigating Officer', 'investigator',
    'Counter/Intake Officer', 'officer',
    'Branch In-charge', 'Prosecutor'
));

-- 3. Cases - extend status enums + add branch review / prosecution columns
ALTER TABLE cases DROP CONSTRAINT IF EXISTS chk_cases_status;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS chk_cases_requested_status;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS branch_review_status varchar(20) DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS branch_reviewed_by int DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS branch_reviewed_at timestamp NULL DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS forwarded_at timestamp NULL DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS file_location varchar(120) DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_date date DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_outcome varchar(30) DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS prosecution_query text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS prosecution_query_at timestamp NULL DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS prosecution_query_resolved_at timestamp NULL DEFAULT NULL;

ALTER TABLE cases ADD CONSTRAINT chk_cases_status CHECK (status IN (
    'Reported', 'Under Investigation', 'Court Pending',
    'Forwarded to Prosecution', 'Closed', 'Archived'
));
ALTER TABLE cases ADD CONSTRAINT chk_cases_requested_status CHECK (requested_status IN (
    'Closed', 'Court Pending', 'Forwarded to Prosecution'
));
ALTER TABLE cases ADD CONSTRAINT chk_cases_branch_review CHECK (branch_review_status IN (
    'Pending Review', 'Recommended', 'Returned'
));
ALTER TABLE cases ADD CONSTRAINT chk_cases_court_outcome CHECK (court_outcome IN (
    'Convicted', 'Acquitted', 'Withdrawn', 'Adjourned'
));

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_case_branch_reviewed_by') THEN
        ALTER TABLE cases ADD CONSTRAINT fk_case_branch_reviewed_by FOREIGN KEY (branch_reviewed_by)
            REFERENCES users (id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. New tables
CREATE TABLE IF NOT EXISTS case_minutes (
  id          SERIAL PRIMARY KEY,
  case_id     int NOT NULL,
  minute_type varchar(30) NOT NULL DEFAULT 'BRANCH_REVIEW',
  author_id   int NOT NULL,
  decision    varchar(20) NOT NULL,
  comment     text,
  created_at  timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_minutes_case   FOREIGN KEY (case_id)   REFERENCES cases (id) ON DELETE CASCADE,
  CONSTRAINT fk_minutes_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_minutes_type CHECK (minute_type IN ('BRANCH_REVIEW', 'COMMANDER_APPROVAL', 'PROSECUTOR_QUERY')),
  CONSTRAINT chk_minutes_decision CHECK (decision IN ('Recommended', 'Returned', 'Approved', 'Rejected', 'Query'))
);

CREATE INDEX IF NOT EXISTS idx_minutes_case_id ON case_minutes (case_id);

CREATE TABLE IF NOT EXISTS external_reports (
  id           SERIAL PRIMARY KEY,
  case_id      int NOT NULL,
  report_type  varchar(40) NOT NULL,
  requested_by int NOT NULL,
  requested_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  status       varchar(20) NOT NULL DEFAULT 'Requested',
  received_at  timestamp NULL DEFAULT NULL,
  notes        text,
  created_at   timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_external_case           FOREIGN KEY (case_id)      REFERENCES cases (id) ON DELETE CASCADE,
  CONSTRAINT fk_external_requested_by   FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_external_type CHECK (report_type IN ('Social Welfare Report', 'Medical Report')),
  CONSTRAINT chk_external_status CHECK (status IN ('Requested', 'Received'))
);

CREATE INDEX IF NOT EXISTS idx_external_case_id ON external_reports (case_id);

CREATE TABLE IF NOT EXISTS case_custody_log (
  id              SERIAL PRIMARY KEY,
  case_id         int NOT NULL,
  handed_over_by  int NOT NULL,
  handed_over_at  timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  received_by     int DEFAULT NULL,
  received_at     timestamp NULL DEFAULT NULL,
  status          varchar(20) NOT NULL DEFAULT 'Pending',
  file_location   varchar(120) DEFAULT NULL,
  notes           text,
  created_at      timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_custody_case        FOREIGN KEY (case_id)          REFERENCES cases (id) ON DELETE CASCADE,
  CONSTRAINT fk_custody_handover_by FOREIGN KEY (handed_over_by)   REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_custody_received_by FOREIGN KEY (received_by)      REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_custody_status CHECK (status IN ('Pending', 'Acknowledged'))
);

CREATE INDEX IF NOT EXISTS idx_custody_case_id ON case_custody_log (case_id);

CREATE TABLE IF NOT EXISTS reassignment_proposals (
  id                     SERIAL PRIMARY KEY,
  case_id                int NOT NULL,
  current_investigator_id int DEFAULT NULL,
  proposed_investigator_id int NOT NULL,
  proposed_by            int NOT NULL,
  reason                 text,
  status                 varchar(20) NOT NULL DEFAULT 'Pending',
  decided_by             int DEFAULT NULL,
  decision_note          text,
  decided_at             timestamp NULL DEFAULT NULL,
  created_at             timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proposal_case       FOREIGN KEY (case_id)                 REFERENCES cases (id)  ON DELETE CASCADE,
  CONSTRAINT fk_proposal_current    FOREIGN KEY (current_investigator_id) REFERENCES users (id)  ON DELETE SET NULL,
  CONSTRAINT fk_proposal_proposed   FOREIGN KEY (proposed_investigator_id) REFERENCES users (id)  ON DELETE RESTRICT,
  CONSTRAINT fk_proposal_by         FOREIGN KEY (proposed_by)             REFERENCES users (id)  ON DELETE RESTRICT,
  CONSTRAINT fk_proposal_decided_by FOREIGN KEY (decided_by)              REFERENCES users (id)  ON DELETE SET NULL,
  CONSTRAINT chk_proposal_status CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);

CREATE INDEX IF NOT EXISTS idx_proposal_case_id ON reassignment_proposals (case_id);