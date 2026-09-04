-- 010_mock_sms_dispatch.sql -- Mock SMS dispatch log (Step V14).
--
-- In prototype, SMS dispatch writes to this table and surfaces in the UI.
-- In production, this would be backed by an SMS aggregator / Cell Broadcast entity.
-- Every dispatched alert records frozen multilingual text (English, Hindi, Mizo)
-- sent to designated recipient groups.

CREATE TABLE IF NOT EXISTS mock_sms_dispatch (
    id              BIGSERIAL PRIMARY KEY,
    alert_id        BIGINT NOT NULL REFERENCES alert(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL DEFAULT 'SMS',
    language        TEXT NOT NULL,
    recipient_group TEXT NOT NULL,
    message_text    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'DELIVERED',
    dispatched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT mock_sms_language CHECK (language IN ('en', 'hi', 'mizo')),
    CONSTRAINT mock_sms_status CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS mock_sms_alert_idx ON mock_sms_dispatch (alert_id);
CREATE INDEX IF NOT EXISTS mock_sms_dispatched_at_idx ON mock_sms_dispatch (dispatched_at DESC);
