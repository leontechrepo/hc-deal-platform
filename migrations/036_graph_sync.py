"""Microsoft Graph delta watermark — one row per (mailbox, folder)."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS graph_sync_state (
            id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_email           TEXT NOT NULL,
            folder               TEXT NOT NULL,
            delta_link           TEXT,
            next_link            TEXT,
            last_synced_at       TIMESTAMPTZ,
            last_error           TEXT,
            consecutive_failures INTEGER NOT NULL DEFAULT 0,
            created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_graph_sync_state UNIQUE (user_email, folder)
        )
    """))
