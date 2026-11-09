-- ============================================================
-- Complainant signature for online complaints
--
-- Stores the signature the complainant draws on the public
-- online complaint form as a base64 image data URL. This is
-- additive only: it never drops or alters station data.
--
-- Safe to run more than once:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-11-09_complainant_signature.sql
-- ============================================================

BEGIN;

ALTER TABLE cases
    ADD COLUMN IF NOT EXISTS complainant_signature text DEFAULT NULL;

COMMIT;
