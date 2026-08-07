from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # Post-close modifications — covenant resets, maturity extensions,
    # additional draws. No existing analog.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS amendments (
            amendment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id         UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            amendment_date  DATE,
            amendment_type  VARCHAR(100),
            description     TEXT,
            approval_log_id UUID REFERENCES approval_log(approval_id) ON DELETE SET NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_amendments_deal_id ON amendments(deal_id)"))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_amendments_approval_log_id ON amendments(approval_log_id)"
    ))
