from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS thread_id TEXT
    """))
    await conn.execute(text("""
        ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS confidence FLOAT
    """))
    await conn.execute(text("""
        ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS current_value TEXT
    """))
    await conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_esl_thread_id ON email_scan_log(thread_id)
    """))
