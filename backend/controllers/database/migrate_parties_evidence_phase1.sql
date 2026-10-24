\set ON_ERROR_STOP on

INSERT INTO case_parties (
  case_id, party_type, witness_number, suspect_id, full_name, national_id,
  phone_number, email, gender, age, occupation, ta, village, address,
  legacy_source, legacy_id, created_by, created_at
)
SELECT
  c.id, 'Complainant', 1, NULL, c.complainant_name, c.complainant_id_number,
  c.complainant_phone, NULL, c.complainant_gender, c.complainant_age,
  c.complainant_occupation, c.complainant_ta, c.complainant_village,
  c.complainant_address, 'cases', c.id, c.recorded_by, c.created_at
FROM cases c
WHERE NOT EXISTS (
  SELECT 1 FROM case_parties cp
  WHERE cp.case_id = c.id
    AND cp.party_type = 'Complainant'
);

WITH numbered_victims AS (
  SELECT
    v.*,
    1 + ROW_NUMBER() OVER (PARTITION BY v.case_id ORDER BY v.id) AS witness_number
  FROM victims v
)
INSERT INTO case_parties (
  case_id, party_type, witness_number, full_name, phone_number, email,
  national_id, age, occupation, ta, village, address, legacy_source,
  legacy_id, created_by, created_at
)
SELECT
  v.case_id, 'Witness', v.witness_number, v.full_name, v.phone_number, v.email,
  v.national_id, v.age, v.occupation, v.ta, v.village, v.address, 'victims',
  v.id, c.recorded_by, v.created_at
FROM numbered_victims v
JOIN cases c ON c.id = v.case_id
WHERE NOT EXISTS (
  SELECT 1 FROM case_parties cp
  WHERE cp.case_id = v.case_id
    AND cp.legacy_source = 'victims'
    AND cp.legacy_id = v.id
);

INSERT INTO case_parties (
  case_id, party_type, witness_number, suspect_id, full_name, first_name,
  last_name, alias, national_id, phone_number, gender, date_of_birth, age,
  occupation, ta, village, address, photo_url, notes, suspect_status,
  legacy_source, legacy_id, created_by, created_at
)
SELECT
  cs.case_id, 'Suspect', NULL, s.id,
  CONCAT_WS(' ', s.first_name, s.last_name),
  s.first_name, s.last_name, s.alias, s.national_id, s.phone_number,
  s.gender, s.date_of_birth, s.age, s.occupation, s.ta, s.village,
  s.address, s.photo_url, s.notes, cs.status, 'case_suspects', cs.id,
  c.recorded_by, cs.created_at
FROM case_suspects cs
JOIN suspects s ON s.id = cs.suspect_id
JOIN cases c ON c.id = cs.case_id
WHERE NOT EXISTS (
  SELECT 1 FROM case_parties cp
  WHERE cp.case_id = cs.case_id
    AND cp.legacy_source = 'case_suspects'
    AND cp.legacy_id = cs.id
);

INSERT INTO case_statements (
  case_id, party_id, statement_text, source, recorded_by, recorded_at, created_at
)
SELECT
  v.case_id, cp.id, v.statement, 'LEGACY_WITNESS',
  c.recorded_by, v.created_at, v.created_at
FROM victims v
JOIN case_parties cp
  ON cp.case_id = v.case_id
 AND cp.legacy_source = 'victims'
 AND cp.legacy_id = v.id
JOIN cases c ON c.id = v.case_id
WHERE v.statement IS NOT NULL
  AND BTRIM(v.statement) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM case_statements st
    WHERE st.party_id = cp.id
      AND st.source = 'LEGACY_WITNESS'
  );

DO $$
DECLARE
  evidence_row RECORD;
BEGIN
  FOR evidence_row IN
    SELECT e.*, c.recorded_by
    FROM evidence e
    JOIN cases c ON c.id = e.case_id
    WHERE NOT EXISTS (
      SELECT 1 FROM evidence_ledger el
      WHERE el.legacy_source = 'evidence'
        AND el.legacy_id = e.id
    )
    ORDER BY e.id
  LOOP
    INSERT INTO evidence_ledger (
      ledger_no, case_id, party_id, item_number, evidence_type, description,
      collected_by_officer_id, collected_at, current_custodian_id, status,
      storage_location, migration_flags, legacy_source, legacy_id, created_by,
      created_at
    ) VALUES (
      next_evidence_ledger_no(), evidence_row.case_id, NULL,
      evidence_row.item_number, evidence_row.category, evidence_row.description,
      evidence_row.collected_by_officer_id, evidence_row.collected_at,
      evidence_row.collected_by_officer_id, evidence_row.status,
      evidence_row.storage_location,
      ARRAY['PROVIDER_UNDETERMINED', 'UNHASHED_LEGACY'],
      'evidence', evidence_row.id, evidence_row.recorded_by,
      evidence_row.created_at
    );

    INSERT INTO evidence_custody_events (
      ledger_id, event_type, to_custodian_id, location, notes, recorded_by,
      event_at, created_at
    )
    SELECT
      el.id, 'Collected', el.collected_by_officer_id, el.storage_location,
      'Imported from the legacy evidence register.', el.collected_by_officer_id,
      el.collected_at, el.created_at
    FROM evidence_ledger el
    WHERE el.legacy_source = 'evidence'
      AND el.legacy_id = evidence_row.id;
  END LOOP;
END $$;
