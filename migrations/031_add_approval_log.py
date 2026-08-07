from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE approval_status_enum AS ENUM ('pending','approved','rejected');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    # Every deal_stage transition and every deal_status change to
    # Passed/Dead/On Hold/Closed is logged here. deal_id is nullable only for
    # a hypothetical future non-deal system event — every row this app
    # writes will have one. "reasoning required on terminal statuses" is
    # left to the app layer (see app/api/approvals.py) rather than a DB
    # CHECK, since "terminal" is a business classification of approval_stage
    # that would otherwise duplicate Python logic in the constraint itself.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS approval_log (
            approval_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id         UUID REFERENCES credit_deals(id) ON DELETE SET NULL,
            approval_stage  VARCHAR(100) NOT NULL,
            approver        VARCHAR(255),
            approval_status approval_status_enum NOT NULL DEFAULT 'pending',
            conditions      JSONB,
            reasoning       TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_approval_log_deal_id ON approval_log(deal_id)"))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_approval_log_approval_stage ON approval_log(approval_stage)"
    ))
