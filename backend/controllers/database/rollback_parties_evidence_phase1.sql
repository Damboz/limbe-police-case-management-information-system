\set ON_ERROR_STOP on

DROP TABLE IF EXISTS evidence_custody_events CASCADE;
DROP TABLE IF EXISTS evidence_ledger CASCADE;
DROP TABLE IF EXISTS case_statements CASCADE;
DROP TABLE IF EXISTS case_parties CASCADE;

DROP FUNCTION IF EXISTS protect_evidence_ledger();
DROP FUNCTION IF EXISTS prevent_append_only_change();
DROP FUNCTION IF EXISTS set_case_party_updated_at();
DROP FUNCTION IF EXISTS set_evidence_ledger_updated_at();
DROP FUNCTION IF EXISTS next_evidence_ledger_no();

DELETE FROM number_sequences WHERE type = 'EV';

ALTER TABLE number_sequences DROP CONSTRAINT IF EXISTS chk_number_type;
ALTER TABLE number_sequences ADD CONSTRAINT chk_number_type CHECK (type IN ('OB', 'CR'));
