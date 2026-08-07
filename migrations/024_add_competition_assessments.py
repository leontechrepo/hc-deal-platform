from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE competition_level_enum AS ENUM ('Low','Medium','High');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    # Append-only time series (reassessed per stage — competitive intensity
    # shifts between LOI and closing) — no updated_at. deal_stage is a
    # free-text snapshot of the stage at assessment time, not a live FK.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS competition_assessments (
            assessment_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id           UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            deal_stage        VARCHAR(100),
            competition_level competition_level_enum,
            assessed_date     DATE,
            notes             TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_competition_assessments_deal_id ON competition_assessments(deal_id)"
    ))
