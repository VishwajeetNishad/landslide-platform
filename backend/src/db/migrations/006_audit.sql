-- 006_audit.sql -- the append-only audit log.
--
-- Records who did what. Its value depends entirely on being impossible to
-- edit afterwards: a log that can be quietly corrected is not evidence.

CREATE TABLE audit_log (
    id  BIGSERIAL   PRIMARY KEY,
    ts  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- NULL means the actor was the system itself (a scheduled ingest, say).
    -- Legitimate, and distinguishable from a human, which is the point.
    actor_id BIGINT REFERENCES app_user(id),

    -- The actor's name AS IT WAS at the time, copied rather than joined.
    -- If someone later edits or deactivates the app_user row, the audit
    -- entry must still say who acted. A join would quietly rewrite history.
    actor_label TEXT NOT NULL,

    action    TEXT NOT NULL,   -- 'ALERT_AUTHORISED', 'PREDICTION_VERIFIED', ...
    entity    TEXT NOT NULL,   -- 'alert', 'prediction'
    entity_id TEXT,

    before JSONB,              -- state before the change
    after  JSONB,              -- state after it

    CONSTRAINT audit_log_action_not_blank CHECK (btrim(action) <> ''),
    CONSTRAINT audit_log_entity_not_blank CHECK (btrim(entity) <> ''),
    CONSTRAINT audit_log_actor_label_not_blank CHECK (btrim(actor_label) <> '')
);

CREATE INDEX audit_log_ts_idx     ON audit_log (ts DESC);
CREATE INDEX audit_log_entity_idx ON audit_log (entity, entity_id);

-- ============================================================
-- APPEND-ONLY, ENFORCED
-- ============================================================
-- WHY A TRIGGER AND NOT `REVOKE UPDATE, DELETE`
--
-- Revoking privileges is the textbook answer and it does not work here.
-- Our application connects as the database owner, and PostgreSQL skips all
-- privilege checks for a superuser or table owner -- so the REVOKE would be
-- silently ineffective and we would be claiming a guarantee we do not have.
-- Creating a separate unprivileged role is the proper long-term fix and is
-- deliberately deferred.
--
-- A trigger, by contrast, cannot be bypassed by anyone: not the owner, not a
-- superuser, not a psql session. It fails loudly with a message that explains
-- itself. That makes it both the stronger guarantee and the one that can be
-- demonstrated live.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP
        USING ERRCODE = 'restrict_violation',
              HINT = 'To correct a wrong entry, append a new entry that supersedes it.';
END;
$$;

-- FOR EACH STATEMENT, not FOR EACH ROW. A row-level trigger only fires for
-- rows that actually match, so `DELETE FROM audit_log WHERE id = 999999`
-- would succeed silently when no such row exists -- reporting success for an
-- operation we have forbidden. A statement-level trigger refuses the
-- statement itself.
CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();

CREATE TRIGGER audit_log_no_delete
    BEFORE DELETE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();

-- TRUNCATE does not fire UPDATE or DELETE triggers -- it is a separate
-- operation and would otherwise empty the entire log while the two triggers
-- above looked like they were protecting it. This is the hole a determined
-- person would find first.
CREATE TRIGGER audit_log_no_truncate
    BEFORE TRUNCATE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
