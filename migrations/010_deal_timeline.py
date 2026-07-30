from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deal_timeline_workstreams (
            id SERIAL PRIMARY KEY,
            deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_timeline_workstreams_deal_id ON deal_timeline_workstreams(deal_id)"
    ))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deal_timeline_tasks (
            id SERIAL PRIMARY KEY,
            workstream_id INTEGER NOT NULL REFERENCES deal_timeline_workstreams(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            owner TEXT,
            start_date DATE,
            end_date DATE,
            duration_days INTEGER,
            status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Complete', 'Blocked')),
            is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_timeline_tasks_workstream_id ON deal_timeline_tasks(workstream_id)"
    ))
