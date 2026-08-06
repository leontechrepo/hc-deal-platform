from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

# (table, uuid_column, not_null, unique) — not_null/unique mirror the
# constraints already present on that table's original integer FK column.
_DEPENDENT_COLUMNS = [
    ("deal_update_log", "deal_uuid_id", True, False),
    ("email_scan_log", "matched_deal_uuid_id", False, False),
    ("pending_suggestions", "deal_uuid_id", False, False),
    ("deal_activity", "deal_uuid_id", True, False),
    ("deal_notes", "deal_uuid_id", True, False),
    ("deal_documents", "deal_uuid_id", True, False),
    ("deal_timeline_workstreams", "deal_uuid_id", True, False),
    ("portfolio_positions", "deal_uuid_id", True, True),
    ("chat_sessions", "deal_uuid_id", False, False),
]


async def upgrade(conn: AsyncConnection) -> None:
    # Step 2 of the deals -> credit_deals UUID primary key conversion. Locks
    # down the new UUID columns added in migration 015 to mirror the
    # constraints their integer counterparts already have, and indexes them
    # — still purely additive, nothing existing is touched.
    for table, column, not_null, unique in _DEPENDENT_COLUMNS:
        if not_null:
            await conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN {column} SET NOT NULL"))
        index_kind = "UNIQUE INDEX" if unique else "INDEX"
        await conn.execute(text(
            f"CREATE {index_kind} IF NOT EXISTS idx_{table}_{column} ON {table}({column})"
        ))
