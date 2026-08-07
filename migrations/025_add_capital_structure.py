from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # The company's full debt stack, not just LCG's piece — amount in cents
    # per the site's literal spec (this table's own convention only; existing
    # tables keep this repo's NUMERIC-millions convention).
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS capital_structure (
            tranche_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id         UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            tranche_type    VARCHAR(100),
            holder          VARCHAR(255),
            amount          BIGINT,
            seniority_rank  INTEGER,
            is_lcg_position BOOLEAN NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_capital_structure_deal_id ON capital_structure(deal_id)"))
