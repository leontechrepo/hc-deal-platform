"""Attachment ingestion and provenance columns on deal_documents."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # Allow unfiled email attachments (no deal until human approval).
    await conn.execute(text("""
        ALTER TABLE deal_documents ALTER COLUMN deal_id DROP NOT NULL
    """))
    await conn.execute(text("""
        ALTER TABLE deal_documents DROP CONSTRAINT IF EXISTS deal_documents_deal_id_fkey
    """))
    await conn.execute(text("""
        ALTER TABLE deal_documents
            ADD CONSTRAINT deal_documents_deal_id_fkey
            FOREIGN KEY (deal_id) REFERENCES credit_deals(id) ON DELETE SET NULL
    """))

    await conn.execute(text(
        "ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS content_type TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS sha256 TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS source TEXT "
        "NOT NULL DEFAULT 'upload'"
    ))
    await conn.execute(text(
        "ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS email_scan_log_id INTEGER "
        "REFERENCES email_scan_log(id) ON DELETE SET NULL"
    ))
    await conn.execute(text(
        "ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS graph_attachment_id TEXT"
    ))
    await conn.execute(text(
        "ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS skip_reason TEXT"
    ))

    # Expand processing_status for attachment/extraction pipeline.
    await conn.execute(text(
        "ALTER TABLE deal_documents DROP CONSTRAINT IF EXISTS chk_deal_documents_processing_status"
    ))
    await conn.execute(text("""
        ALTER TABLE deal_documents ADD CONSTRAINT chk_deal_documents_processing_status
        CHECK (processing_status IS NULL OR processing_status IN (
            'pending','extracted','needs_review','skipped','failed'
        ))
    """))

    await conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_documents_sha_deal
            ON deal_documents (sha256, deal_id)
            WHERE status = 'active' AND sha256 IS NOT NULL AND deal_id IS NOT NULL
    """))
    await conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_documents_sha_unfiled
            ON deal_documents (sha256)
            WHERE status = 'active' AND sha256 IS NOT NULL AND deal_id IS NULL
    """))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deal_document_email_logs (
            document_id         INTEGER NOT NULL
                REFERENCES deal_documents(id) ON DELETE CASCADE,
            email_scan_log_id   INTEGER NOT NULL
                REFERENCES email_scan_log(id) ON DELETE CASCADE,
            PRIMARY KEY (document_id, email_scan_log_id)
        )
    """))

    # Extraction runs (Corporate Credit typed candidates).
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deal_extraction_runs (
            id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id                 UUID NOT NULL
                REFERENCES credit_deals(id) ON DELETE CASCADE,
            suggestion_id           INTEGER
                REFERENCES pending_suggestions(id) ON DELETE SET NULL,
            status                  TEXT NOT NULL DEFAULT 'pending',
            retry_count             INTEGER NOT NULL DEFAULT 0,
            input_tokens            INTEGER NOT NULL DEFAULT 0,
            output_tokens           INTEGER NOT NULL DEFAULT 0,
            estimated_cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
            model                   TEXT,
            extracted_fields        JSONB,
            applied_fields          JSONB,
            applied_field_count     INTEGER NOT NULL DEFAULT 0,
            low_confidence_fields   JSONB,
            conflicts               JSONB,
            document_errors         JSONB,
            last_error              TEXT,
            started_at              TIMESTAMPTZ,
            finished_at             TIMESTAMPTZ,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_deal_extraction_runs_status
                CHECK (status IN ('pending','processing','complete','error'))
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_deal_extraction_runs_status "
        "ON deal_extraction_runs (status)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_deal_extraction_runs_deal "
        "ON deal_extraction_runs (deal_id)"
    ))
