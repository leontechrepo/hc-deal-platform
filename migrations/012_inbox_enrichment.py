from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS email_snippet TEXT"))
    await conn.execute(text("ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS estimated_size_m NUMERIC(10,2)"))
    await conn.execute(text("ALTER TABLE pending_suggestions ADD COLUMN IF NOT EXISTS estimated_sector TEXT"))
