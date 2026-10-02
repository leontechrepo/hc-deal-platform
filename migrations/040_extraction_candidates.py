"""Persisted, reviewable extraction candidates.

Every typed candidate a document run produces is stored with its evidence, source
document and disposition so ambiguous or conflicting values stay visible to
reviewers instead of vanishing into a run's JSON blob. Also lets a run be scoped
to explicit documents (manual / backfill runs).
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deal_extraction_candidates (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            run_id           UUID NOT NULL REFERENCES deal_extraction_runs(id) ON DELETE CASCADE,
            deal_id          UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            document_id      INTEGER REFERENCES deal_documents(id) ON DELETE SET NULL,
            field            TEXT NOT NULL,
            raw_value        TEXT NOT NULL,
            display_value    TEXT,
            confidence       NUMERIC(4,3) NOT NULL,
            evidence         TEXT NOT NULL,
            status           TEXT NOT NULL,
            reason           TEXT,
            current_value    TEXT,
            reviewed_by      TEXT,
            reviewed_at      TIMESTAMPTZ,
            review_note      TEXT,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_extraction_candidate_status CHECK (status IN (
                'applied','suggested','conflict','differs_from_current',
                'matches_existing','corroborating','superseded','invalid',
                'accepted','rejected'
            ))
        )
    """))
    for stmt in (
        "CREATE INDEX IF NOT EXISTS idx_extraction_candidates_run ON deal_extraction_candidates (run_id)",
        "CREATE INDEX IF NOT EXISTS idx_extraction_candidates_deal_status "
        "ON deal_extraction_candidates (deal_id, status)",
        "CREATE INDEX IF NOT EXISTS idx_extraction_candidates_document "
        "ON deal_extraction_candidates (document_id)",
        "ALTER TABLE deal_extraction_runs ADD COLUMN IF NOT EXISTS document_ids INTEGER[]",
        "ALTER TABLE deal_extraction_runs ADD COLUMN IF NOT EXISTS trigger TEXT NOT NULL DEFAULT 'approval'",
        "ALTER TABLE deal_extraction_runs ADD COLUMN IF NOT EXISTS requested_by TEXT",
        "ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS extraction_run_id UUID "
        "REFERENCES deal_extraction_runs(id) ON DELETE SET NULL",
    ):
        await conn.execute(text(stmt))
