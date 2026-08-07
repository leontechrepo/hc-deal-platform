from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS participant_lenders (
            participant_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id              UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            lender_name          VARCHAR(255) NOT NULL,
            participation_amount BIGINT,
            is_agent             BOOLEAN NOT NULL DEFAULT FALSE,
            created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_participant_lenders_deal_id ON participant_lenders(deal_id)"
    ))
