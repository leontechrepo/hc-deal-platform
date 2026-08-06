from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE covenant_type_enum AS ENUM ('Financial','Negative','Affirmative');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE covenant_test_frequency_enum AS ENUM ('Quarterly','Monthly','Annual');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    # Financial covenants have a threshold and a test schedule; negative and
    # affirmative covenants are compliance checklist items, not numeric
    # tests — the CHECK keeps threshold_value from being set on the latter.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS covenants (
            covenant_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id         UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            covenant_type   covenant_type_enum NOT NULL,
            covenant_name   VARCHAR(255) NOT NULL,
            threshold_value DECIMAL,
            test_frequency  covenant_test_frequency_enum,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_covenants_threshold_financial_only
                CHECK (threshold_value IS NULL OR covenant_type = 'Financial')
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_covenants_deal_id ON covenants(deal_id)"))
