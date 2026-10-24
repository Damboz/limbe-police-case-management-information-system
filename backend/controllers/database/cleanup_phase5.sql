-- Phase 5 Cleanup Migration
-- Remove deprecated tables/columns/routes/views from old implementation
-- Only run after confirming nothing uses them

BEGIN;

-- Drop old evidence edit/delete related objects if they exist
DROP TRIGGER IF EXISTS prevent_evidence_update ON evidence;
DROP TRIGGER IF EXISTS prevent_evidence_delete ON evidence;

-- Drop old evidence table if no references remain (we migrated to evidence_ledger)
-- Check: we keep evidence table for backward compatibility in case, but routes removed
-- To fully remove, uncomment after verification:
-- DROP TABLE IF EXISTS evidence CASCADE;

-- Drop old victims table if migrated
-- DROP TABLE IF EXISTS victims CASCADE;

-- Drop old suspects/case_suspects if fully migrated to case_parties
-- DROP TABLE IF EXISTS case_suspects CASCADE;
-- DROP TABLE IF EXISTS suspects CASCADE;

-- Note: We keep legacy tables for safety; routes/views removed in code.
-- Columns on cases (complainant_*) are kept for compatibility and display.

COMMIT;

-- List removed (code-level):
-- Routes removed: POST /api/cases/:id/evidence, POST /api/evidence/:id/status, POST /api/evidence/:id/transfer, POST /api/evidence/:id/dispose
-- Views/UI removed: separate Suspects and Victims sections replaced by unified Parties tab
-- Edit/Delete for ledger entries: no routes exist (append-only enforced by triggers + no update/delete endpoints)
