from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

_TABLES = [
    "credit_deals", "deal_update_log", "email_scan_log", "pending_suggestions",
    "deal_activity", "deal_notes", "deal_documents", "deal_timeline_workstreams",
    "portfolio_positions", "chat_sessions",
]


async def upgrade(conn: AsyncConnection) -> None:
    # Refresh planner statistics immediately after the migration 017 cutover
    # so the new UUID PK/FK columns don't cause a transient bad query plan.
    for table in _TABLES:
        await conn.execute(text(f"ANALYZE {table}"))
