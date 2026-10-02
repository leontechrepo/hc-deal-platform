"""Email mining upgrade: scan runs, LLM ledger, claim-safe scan log, suggestion provenance.

Keeps integer PKs on email_scan_log and pending_suggestions for API compatibility.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS scan_runs (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            trigger                 TEXT NOT NULL,
            status                  TEXT NOT NULL DEFAULT 'running',
            started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            finished_at             TIMESTAMPTZ,
            users_scanned           TEXT[],
            messages_seen           INTEGER NOT NULL DEFAULT 0,
            messages_deduped        INTEGER NOT NULL DEFAULT 0,
            messages_filtered       INTEGER NOT NULL DEFAULT 0,
            messages_classified     INTEGER NOT NULL DEFAULT 0,
            suggestions_created     INTEGER NOT NULL DEFAULT 0,
            suggestions_updated     INTEGER NOT NULL DEFAULT 0,
            field_updates_proposed  INTEGER NOT NULL DEFAULT 0,
            field_updates_rejected  INTEGER NOT NULL DEFAULT 0,
            input_tokens            BIGINT NOT NULL DEFAULT 0,
            output_tokens           BIGINT NOT NULL DEFAULT 0,
            cache_read_tokens       BIGINT NOT NULL DEFAULT 0,
            cache_write_tokens      BIGINT NOT NULL DEFAULT 0,
            estimated_cost_usd      NUMERIC(10,4) NOT NULL DEFAULT 0,
            graph_requests          INTEGER NOT NULL DEFAULT 0,
            error_counts            JSONB,
            error_message           TEXT,
            CONSTRAINT chk_scan_runs_trigger
                CHECK (trigger IN ('scheduler','manual','backfill')),
            CONSTRAINT chk_scan_runs_status
                CHECK (status IN (
                    'running','completed','failed','budget_exceeded','skipped_locked'
                ))
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_scan_runs_started_at ON scan_runs (started_at DESC)"
    ))

    # Evolve email_scan_log for claim-before-classify and multi-mailbox delta sync.
    await conn.execute(text(
        "ALTER TABLE email_scan_log DROP CONSTRAINT IF EXISTS uq_email_scan_log_message_id"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS scan_run_id UUID "
        "REFERENCES scan_runs(id) ON DELETE SET NULL"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT 'inbox'"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS internet_message_id TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS sender_address TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS sender_domain TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS sender_name TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS has_attachments "
        "BOOLEAN NOT NULL DEFAULT FALSE"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS attachment_count "
        "INTEGER NOT NULL DEFAULT 0"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS attachment_summary JSONB"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS body_snippet TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS body_source TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS prepared_chars INTEGER"
    ))
    await conn.execute(text(
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS error TEXT"
    ))
    # Default existing rows keep their action; new claims start as processing.
    await conn.execute(text("""
        UPDATE email_scan_log SET action_taken = 'no_match'
        WHERE action_taken IS NULL
    """))
    await conn.execute(text("""
        DO $$ BEGIN
            ALTER TABLE email_scan_log
                ADD CONSTRAINT uq_email_scan_log_user_message
                UNIQUE (user_email, graph_message_id);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_email_scan_log_internet_message_id "
        "ON email_scan_log (internet_message_id)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_email_scan_log_scan_run_id "
        "ON email_scan_log (scan_run_id)"
    ))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS llm_calls (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scan_run_id         UUID REFERENCES scan_runs(id) ON DELETE CASCADE,
            email_scan_log_id   INTEGER REFERENCES email_scan_log(id) ON DELETE SET NULL,
            purpose             TEXT NOT NULL,
            model               TEXT NOT NULL,
            tool_round          INTEGER NOT NULL DEFAULT 0,
            input_tokens        INTEGER NOT NULL DEFAULT 0,
            output_tokens       INTEGER NOT NULL DEFAULT 0,
            cache_read_tokens   INTEGER NOT NULL DEFAULT 0,
            cache_write_tokens  INTEGER NOT NULL DEFAULT 0,
            estimated_cost_usd  NUMERIC(10,6) NOT NULL DEFAULT 0,
            latency_ms          INTEGER,
            stop_reason         TEXT,
            request_id          TEXT,
            error               TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_llm_calls_purpose
                CHECK (purpose IN ('classify_body','extract_document'))
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_llm_calls_scan_run ON llm_calls (scan_run_id)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_llm_calls_created_at ON llm_calls (created_at DESC)"
    ))

    # Suggestion enrichment — keep integer id and suggested_field for API compat.
    await conn.execute(text(
        "ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS kind TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS evidence TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS payload JSONB"
    ))
    await conn.execute(text(
        "ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS requires_attention "
        "BOOLEAN NOT NULL DEFAULT FALSE"
    ))
    await conn.execute(text(
        "ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS dedupe_key TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS updated_at "
        "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
    ))

    # Backfill kind + dedupe_key so the unique index can be created.
    await conn.execute(text("""
        UPDATE pending_suggestions SET kind = CASE
            WHEN suggested_field = 'new_deal' THEN 'new_deal'
            WHEN suggested_field = 'commentary' THEN 'commentary'
            ELSE 'field_update'
        END
        WHERE kind IS NULL
    """))
    await conn.execute(text("""
        UPDATE pending_suggestions SET dedupe_key = md5(
            coalesce(deal_id::text, '-') || E'\\x1f' ||
            coalesce(id::text, '-') || E'\\x1f' ||
            coalesce(kind, 'field_update') || E'\\x1f' ||
            coalesce(suggested_field, '-') || E'\\x1f' ||
            coalesce(id::text, '-')
        )
        WHERE dedupe_key IS NULL
    """))
    await conn.execute(text("""
        ALTER TABLE pending_suggestions ALTER COLUMN kind SET NOT NULL
    """))
    await conn.execute(text("""
        ALTER TABLE pending_suggestions ALTER COLUMN dedupe_key SET NOT NULL
    """))
    await conn.execute(text("""
        DO $$ BEGIN
            ALTER TABLE pending_suggestions
                ADD CONSTRAINT chk_pending_suggestions_kind
                CHECK (kind IN ('new_deal','commentary','field_update'));
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))
    await conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_suggestions_dedupe
            ON pending_suggestions (dedupe_key) WHERE status = 'pending'
    """))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS pending_suggestion_email_logs (
            suggestion_id       INTEGER NOT NULL
                REFERENCES pending_suggestions(id) ON DELETE CASCADE,
            email_scan_log_id   INTEGER NOT NULL
                REFERENCES email_scan_log(id) ON DELETE CASCADE,
            PRIMARY KEY (suggestion_id, email_scan_log_id)
        )
    """))
    await conn.execute(text("""
        INSERT INTO pending_suggestion_email_logs (suggestion_id, email_scan_log_id)
        SELECT id, email_scan_log_id FROM pending_suggestions
        WHERE email_scan_log_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """))
