from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE screening_recommendation_enum AS ENUM ('go','no_go','hold');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE screening_status_enum AS ENUM ('draft','decided');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    # Versioned, append-only — "drafted against the memo-library corpus,
    # never overwritten". No existing analog; genuinely new capability.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS screening_memos (
            memo_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id             UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            version             INTEGER NOT NULL,
            recommendation      screening_recommendation_enum,
            memo_doc_ref        VARCHAR(500),
            corpus_reference    VARCHAR(255),
            status              screening_status_enum NOT NULL DEFAULT 'draft',
            data_classification data_classification_enum NOT NULL DEFAULT 'Internal',
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (deal_id, version)
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_screening_memos_deal_id ON screening_memos(deal_id)"))
