from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # Judgment-based internal rating, separate from raw covenant pass/fail —
    # dated time series layered alongside the existing flat one-shot
    # credit_deals.risk_score (left untouched — additive only).
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS risk_ratings (
            rating_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id     UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            rating_date DATE NOT NULL,
            risk_grade  VARCHAR(20),
            rationale   TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_risk_ratings_deal_id ON risk_ratings(deal_id)"))
