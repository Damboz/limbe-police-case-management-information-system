# Plain-Language Summary of New Design (for Project Report)

## Party Model
- All parties (Complainant, Witness, Suspect) are stored in a single `case_parties` table with `party_type`.
- The complainant is automatically created as Witness No. 1 at case registration.
- Adding a witness assigns the next sequential witness number automatically.
- Suspects are linked via `suspect_id` to the `suspects` table but represented in `case_parties` with role badge.

## Append-Only Ledger
- Evidence is tracked in `evidence_ledger` (append-only). Database triggers prevent updates/deletes of core fields and deletion of ledger entries; no API routes exist for editing or deleting ledger entries.
- Each evidence item gets a unique auto-generated ledger number (`EV-YYYY-XXXX`) via sequence function.
- First custody event ("Collected") is created automatically on capture/creation.

## Hashing
- Files are hashed with SHA-256 at the time of saving. Hash is stored in `evidence_ledger.sha256` and can be recomputed on demand via "Verify Integrity" to detect tampering.

## Chain of Custody
- All custody actions are recorded in `evidence_custody_events` (append-only). Transfers require request by Investigating Officer and approval by Station Commander, creating new custody events. Notes/corrections are appended as events. Earlier entries are never edited or deleted.
