\set ON_ERROR_STOP on

SELECT 'required tables' AS check_name,
       CASE
         WHEN to_regclass('public.case_parties') IS NOT NULL
          AND to_regclass('public.case_statements') IS NOT NULL
          AND to_regclass('public.evidence_ledger') IS NOT NULL
          AND to_regclass('public.evidence_custody_events') IS NOT NULL
         THEN 'PASS' ELSE 'FAIL'
       END AS result;

SELECT 'cases missing complainant party' AS check_name, COUNT(*) AS result
FROM cases c
WHERE NOT EXISTS (
  SELECT 1 FROM case_parties cp
  WHERE cp.case_id = c.id AND cp.party_type = 'Complainant'
);

SELECT 'witness count difference' AS check_name,
       (SELECT COUNT(*) FROM victims) - (
         SELECT COUNT(*) FROM case_parties
         WHERE legacy_source = 'victims'
       ) AS result;

SELECT 'suspects missing linked party' AS check_name, COUNT(*) AS result
FROM case_suspects cs
WHERE NOT EXISTS (
  SELECT 1 FROM case_parties cp
  WHERE cp.case_id = cs.case_id
    AND cp.legacy_source = 'case_suspects'
    AND cp.legacy_id = cs.id
);

SELECT 'legacy witness statements not copied' AS check_name, COUNT(*) AS result
FROM victims v
WHERE v.statement IS NOT NULL
  AND BTRIM(v.statement) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM case_parties cp
    JOIN case_statements st ON st.party_id = cp.id
    WHERE cp.legacy_source = 'victims'
      AND cp.legacy_id = v.id
      AND st.source = 'LEGACY_WITNESS'
  );

SELECT 'legacy evidence not copied' AS check_name, COUNT(*) AS result
FROM evidence e
WHERE NOT EXISTS (
  SELECT 1 FROM evidence_ledger el
  WHERE el.legacy_source = 'evidence'
    AND el.legacy_id = e.id
);

SELECT 'legacy evidence missing custody origin event' AS check_name, COUNT(*) AS result
FROM evidence_ledger el
WHERE el.legacy_source = 'evidence'
  AND NOT EXISTS (
    SELECT 1 FROM evidence_custody_events ce
    WHERE ce.ledger_id = el.id
      AND ce.event_type = 'Collected'
  );

SELECT 'duplicate witness numbers' AS check_name, COUNT(*) AS result
FROM (
  SELECT case_id, witness_number
  FROM case_parties
  WHERE witness_number IS NOT NULL
  GROUP BY case_id, witness_number
  HAVING COUNT(*) > 1
) duplicates;

SELECT 'invalid witness numbering' AS check_name, COUNT(*) AS result
FROM case_parties
WHERE (party_type = 'Complainant' AND witness_number <> 1)
   OR (party_type = 'Witness' AND (witness_number IS NULL OR witness_number < 2))
   OR (party_type = 'Suspect' AND witness_number IS NOT NULL);

SELECT 'evidence with provider from another case' AS check_name, COUNT(*) AS result
FROM evidence_ledger el
JOIN case_parties cp ON cp.id = el.party_id
WHERE cp.case_id <> el.case_id;

SELECT 'invalid ledger numbers' AS check_name, COUNT(*) AS result
FROM evidence_ledger
WHERE ledger_no !~ '^EV-[0-9]{4}-[0-9]{4,}$';

SELECT COUNT(*) AS case_parties,
       (SELECT COUNT(*) FROM case_statements) AS case_statements,
       (SELECT COUNT(*) FROM evidence_ledger) AS evidence_ledger,
       (SELECT COUNT(*) FROM evidence_custody_events) AS evidence_custody_events
FROM case_parties;
