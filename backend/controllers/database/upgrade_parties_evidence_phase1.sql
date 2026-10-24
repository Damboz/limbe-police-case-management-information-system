\set ON_ERROR_STOP on

ALTER TABLE number_sequences DROP CONSTRAINT IF EXISTS chk_number_type;
ALTER TABLE number_sequences ADD CONSTRAINT chk_number_type CHECK (type IN ('OB', 'CR', 'EV'));

CREATE TABLE IF NOT EXISTS case_parties (
  id              SERIAL PRIMARY KEY,
  case_id         int NOT NULL,
  party_type      varchar(20) NOT NULL,
  witness_number  int DEFAULT NULL,
  suspect_id      int DEFAULT NULL,
  full_name       varchar(150) NOT NULL,
  first_name      varchar(50) DEFAULT NULL,
  last_name       varchar(50) DEFAULT NULL,
  alias           varchar(50) DEFAULT NULL,
  national_id     varchar(50) DEFAULT NULL,
  phone_number    varchar(20) DEFAULT NULL,
  email           varchar(100) DEFAULT NULL,
  gender          varchar(10) DEFAULT NULL,
  date_of_birth   date DEFAULT NULL,
  age             int DEFAULT NULL,
  occupation      varchar(100) DEFAULT NULL,
  ta              varchar(100) DEFAULT NULL,
  village         varchar(100) DEFAULT NULL,
  address         text,
  photo_url       varchar(255) DEFAULT NULL,
  notes           text,
  suspect_status  varchar(30) DEFAULT NULL,
  legacy_source   varchar(30) DEFAULT NULL,
  legacy_id       int DEFAULT NULL,
  created_by      int DEFAULT NULL,
  created_at      timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_case_parties_case       FOREIGN KEY (case_id)    REFERENCES cases (id)    ON DELETE CASCADE,
  CONSTRAINT fk_case_parties_suspect    FOREIGN KEY (suspect_id) REFERENCES suspects (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_parties_created_by FOREIGN KEY (created_by) REFERENCES users (id)    ON DELETE SET NULL,
  CONSTRAINT chk_case_parties_type CHECK (party_type IN ('Complainant', 'Witness', 'Suspect')),
  CONSTRAINT chk_case_parties_gender CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
  CONSTRAINT chk_case_parties_witness_number CHECK (
    (party_type = 'Complainant' AND witness_number = 1)
    OR (party_type = 'Witness' AND witness_number IS NOT NULL AND witness_number >= 2)
    OR (party_type = 'Suspect' AND witness_number IS NULL)
  ),
  CONSTRAINT chk_case_parties_suspect_link CHECK (
    (party_type = 'Suspect' AND suspect_id IS NOT NULL)
    OR (party_type <> 'Suspect' AND suspect_id IS NULL)
  ),
  CONSTRAINT uq_case_parties_witness UNIQUE (case_id, witness_number),
  CONSTRAINT uq_case_parties_legacy UNIQUE (case_id, legacy_source, legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_case_parties_case_id ON case_parties (case_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_type ON case_parties (case_id, party_type);
CREATE INDEX IF NOT EXISTS idx_case_parties_suspect_id ON case_parties (suspect_id);

CREATE TABLE IF NOT EXISTS case_statements (
  id             SERIAL PRIMARY KEY,
  case_id        int NOT NULL,
  party_id       int NOT NULL,
  statement_text text NOT NULL,
  source         varchar(30) NOT NULL DEFAULT 'INTAKE',
  recorded_by    int DEFAULT NULL,
  recorded_at    timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_case_statements_case       FOREIGN KEY (case_id)  REFERENCES cases (id)        ON DELETE CASCADE,
  CONSTRAINT fk_case_statements_party      FOREIGN KEY (party_id) REFERENCES case_parties (id) ON DELETE CASCADE,
  CONSTRAINT fk_case_statements_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id)    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_case_statements_case_id ON case_statements (case_id);
CREATE INDEX IF NOT EXISTS idx_case_statements_party_id ON case_statements (party_id);

CREATE TABLE IF NOT EXISTS evidence_ledger (
  id                      SERIAL PRIMARY KEY,
  ledger_no               varchar(20) NOT NULL,
  case_id                 int NOT NULL,
  party_id                int DEFAULT NULL,
  item_number             varchar(50) DEFAULT NULL,
  evidence_type           varchar(20) NOT NULL DEFAULT 'Physical',
  description             text NOT NULL,
  file_name               varchar(255) DEFAULT NULL,
  file_path               varchar(500) DEFAULT NULL,
  mime_type               varchar(100) DEFAULT NULL,
  file_size               bigint DEFAULT NULL,
  sha256                  char(64) DEFAULT NULL,
  collected_by_officer_id int NOT NULL,
  collected_at            timestamp NOT NULL,
  current_custodian_id    int DEFAULT NULL,
  status                  varchar(30) NOT NULL DEFAULT 'In Locker',
  storage_location        varchar(150) DEFAULT NULL,
  migration_flags         text[] NOT NULL DEFAULT '{}',
  legacy_source           varchar(30) DEFAULT NULL,
  legacy_id               int DEFAULT NULL,
  created_by              int DEFAULT NULL,
  created_at              timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evidence_ledger_case          FOREIGN KEY (case_id)                 REFERENCES cases (id)        ON DELETE CASCADE,
  CONSTRAINT fk_evidence_ledger_party         FOREIGN KEY (party_id)                REFERENCES case_parties (id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_ledger_collected_by  FOREIGN KEY (collected_by_officer_id) REFERENCES users (id)         ON DELETE RESTRICT,
  CONSTRAINT fk_evidence_ledger_custodian     FOREIGN KEY (current_custodian_id)    REFERENCES users (id)         ON DELETE SET NULL,
  CONSTRAINT fk_evidence_ledger_created_by    FOREIGN KEY (created_by)              REFERENCES users (id)         ON DELETE SET NULL,
  CONSTRAINT uq_evidence_ledger_no UNIQUE (ledger_no),
  CONSTRAINT uq_evidence_ledger_legacy UNIQUE (legacy_source, legacy_id),
  CONSTRAINT chk_evidence_ledger_type CHECK (evidence_type IN ('Physical', 'Documentary', 'Digital', 'Forensic', 'Weapon', 'Other')),
  CONSTRAINT chk_evidence_ledger_status CHECK (status IN ('In Locker', 'Transferred to Lab', 'Presented in Court', 'Returned', 'Disposed')),
  CONSTRAINT chk_evidence_ledger_hash CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chk_evidence_ledger_size CHECK (file_size IS NULL OR file_size >= 0)
);

CREATE INDEX IF NOT EXISTS idx_evidence_ledger_case_id ON evidence_ledger (case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_ledger_party_id ON evidence_ledger (party_id);
CREATE INDEX IF NOT EXISTS idx_evidence_ledger_status ON evidence_ledger (status);

CREATE TABLE IF NOT EXISTS evidence_custody_events (
  id                SERIAL PRIMARY KEY,
  ledger_id         int NOT NULL,
  event_type        varchar(30) NOT NULL DEFAULT 'Collected',
  from_custodian_id int DEFAULT NULL,
  to_custodian_id   int DEFAULT NULL,
  location          varchar(150) DEFAULT NULL,
  notes             text,
  recorded_by       int NOT NULL,
  event_at          timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  created_at        timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evidence_events_ledger     FOREIGN KEY (ledger_id)         REFERENCES evidence_ledger (id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_events_from       FOREIGN KEY (from_custodian_id) REFERENCES users (id)           ON DELETE SET NULL,
  CONSTRAINT fk_evidence_events_to         FOREIGN KEY (to_custodian_id)   REFERENCES users (id)           ON DELETE SET NULL,
  CONSTRAINT fk_evidence_events_recorded_by FOREIGN KEY (recorded_by)      REFERENCES users (id)           ON DELETE RESTRICT,
  CONSTRAINT chk_evidence_events_type CHECK (event_type IN ('Collected', 'Transferred', 'Returned', 'Presented in Court', 'Disposed'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_events_ledger_id ON evidence_custody_events (ledger_id);

CREATE OR REPLACE FUNCTION next_evidence_ledger_no() RETURNS varchar AS $$
DECLARE
  target_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  next_number int;
BEGIN
  INSERT INTO number_sequences (year, type, last_number, updated_at)
  VALUES (target_year, 'EV', 1, CURRENT_TIMESTAMP)
  ON CONFLICT (year, type)
  DO UPDATE SET last_number = number_sequences.last_number + 1, updated_at = CURRENT_TIMESTAMP
  RETURNING last_number INTO next_number;

  RETURN 'EV-' || target_year::text || '-' || LPAD(next_number::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_append_only_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '%.% is append-only', TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_evidence_ledger() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'evidence_ledger is append-only';
  END IF;

  IF NEW.id <> OLD.id
     OR NEW.ledger_no <> OLD.ledger_no
     OR NEW.case_id <> OLD.case_id
     OR NEW.party_id IS DISTINCT FROM OLD.party_id
     OR NEW.item_number IS DISTINCT FROM OLD.item_number
     OR NEW.evidence_type <> OLD.evidence_type
     OR NEW.description <> OLD.description
     OR NEW.file_name IS DISTINCT FROM OLD.file_name
     OR NEW.file_path IS DISTINCT FROM OLD.file_path
     OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
     OR NEW.file_size IS DISTINCT FROM OLD.file_size
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.collected_by_officer_id <> OLD.collected_by_officer_id
     OR NEW.collected_at <> OLD.collected_at
     OR NEW.legacy_source IS DISTINCT FROM OLD.legacy_source
     OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'evidence_ledger core fields are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_case_party_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_evidence_ledger_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_case_statements_update ON case_statements;
CREATE TRIGGER prevent_case_statements_update
  BEFORE UPDATE OR DELETE ON case_statements
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_change();

DROP TRIGGER IF EXISTS prevent_evidence_events_update ON evidence_custody_events;
CREATE TRIGGER prevent_evidence_events_update
  BEFORE UPDATE OR DELETE ON evidence_custody_events
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_change();

DROP TRIGGER IF EXISTS protect_evidence_ledger_update ON evidence_ledger;
CREATE TRIGGER protect_evidence_ledger_update
  BEFORE UPDATE OR DELETE ON evidence_ledger
  FOR EACH ROW EXECUTE FUNCTION protect_evidence_ledger();

DROP TRIGGER IF EXISTS set_case_parties_updated_at ON case_parties;
CREATE TRIGGER set_case_parties_updated_at
  BEFORE UPDATE ON case_parties
  FOR EACH ROW EXECUTE FUNCTION set_case_party_updated_at();

DROP TRIGGER IF EXISTS set_evidence_ledger_updated_at ON evidence_ledger;
CREATE TRIGGER set_evidence_ledger_updated_at
  BEFORE UPDATE ON evidence_ledger
  FOR EACH ROW EXECUTE FUNCTION set_evidence_ledger_updated_at();
