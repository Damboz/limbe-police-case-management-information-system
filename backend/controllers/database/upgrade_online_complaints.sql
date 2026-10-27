-- Online complaint intake and approval.
--
-- A complaint submitted by the public is stored in `cases` with
-- source = 'Online' and complaint_status = 'Pending'. It is hidden from the
-- normal case register until an officer approves it. This script brings an
-- existing database up to the same shape as init.sql / init.neon.sql.

ALTER TABLE cases ADD COLUMN IF NOT EXISTS source varchar(20) DEFAULT 'Counter';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS complaint_status varchar(20) DEFAULT 'Approved';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS approved_by int DEFAULT NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL DEFAULT NULL;

UPDATE cases SET source = 'Counter' WHERE source IS NULL;
UPDATE cases SET complaint_status = 'Approved' WHERE complaint_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_case_approved_by') THEN
    ALTER TABLE cases
      ADD CONSTRAINT fk_case_approved_by FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_source') THEN
    ALTER TABLE cases
      ADD CONSTRAINT chk_cases_source CHECK (source IN ('Counter', 'Online'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cases_complaint_status') THEN
    ALTER TABLE cases
      ADD CONSTRAINT chk_cases_complaint_status CHECK (complaint_status IN ('Pending', 'Approved', 'Rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cases_complaint_status ON cases (complaint_status);
CREATE INDEX IF NOT EXISTS idx_cases_source ON cases (source);
