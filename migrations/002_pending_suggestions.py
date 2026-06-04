from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS pending_suggestions (
            id SERIAL PRIMARY KEY,
            deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
            email_scan_log_id INTEGER REFERENCES email_scan_log(id) ON DELETE SET NULL,
            suggested_field TEXT NOT NULL DEFAULT 'commentary',
            suggested_value TEXT,
            claude_summary TEXT,
            email_subject TEXT,
            source TEXT NOT NULL DEFAULT 'email_scan',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ,
            reviewed_by TEXT
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ps_status ON pending_suggestions(status)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_ps_deal_id ON pending_suggestions(deal_id)"))
