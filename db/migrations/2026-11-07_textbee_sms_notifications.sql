-- ============================================================
-- TextBee SMS notifications
--
-- Creates the table that records every assignment SMS attempt.
-- This is additive only: it never drops or alters station data.
-- The retired Brevo `sms_logs` table (if it exists) is left in
-- place untouched and is no longer used by the application.
--
-- Safe to run more than once:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-11-07_textbee_sms_notifications.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sms_notifications (
    id         SERIAL PRIMARY KEY,
    case_id    int NOT NULL,
    officer_id int NOT NULL,
    role       varchar(40) NOT NULL,
    phone      varchar(30) DEFAULT NULL,
    message    text,
    status     varchar(10) NOT NULL DEFAULT 'PENDING',
    error      text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at    timestamptz DEFAULT NULL,
    CONSTRAINT fk_sms_notifications_case FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE,
    CONSTRAINT fk_sms_notifications_officer FOREIGN KEY (officer_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Add the status guard separately so this migration also upgrades a table
-- created by an earlier build that lacked it.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_sms_notifications_status'
    ) THEN
        ALTER TABLE sms_notifications
            ADD CONSTRAINT chk_sms_notifications_status
            CHECK (status IN ('PENDING', 'SENT', 'FAILED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sms_notifications_case ON sms_notifications (case_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_officer ON sms_notifications (officer_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_created ON sms_notifications (created_at);

COMMIT;
