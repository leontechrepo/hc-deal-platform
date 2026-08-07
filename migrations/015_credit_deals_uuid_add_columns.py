from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

# Every table with a deal_id-shaped FK to deals.id, paired with the FK column
# name on that table (most are "deal_id"; two legacy names differ).
_DEPENDENT_TABLES = [
    ("deal_update_log", "deal_id"),
    ("email_scan_log", "matched_deal_id"),
    ("pending_suggestions", "deal_id"),
    ("deal_activity", "deal_id"),
    ("deal_notes", "deal_id"),
    ("deal_documents", "deal_id"),
    ("deal_timeline_workstreams", "deal_id"),
    ("portfolio_positions", "deal_id"),
    ("chat_sessions", "deal_id"),
]


async def upgrade(conn: AsyncConnection) -> None:
    # Step 1 of the deals -> credit_deals UUID primary key conversion. Purely
    # additive: adds a parallel UUID identity column everywhere and backfills
    # it, but touches no existing column/constraint, so this is safe to land
    # and run well ahead of the actual cutover (migration 017).
    await conn.execute(text(
        "ALTER TABLE deals ADD COLUMN IF NOT EXISTS uuid_id UUID NOT NULL DEFAULT gen_random_uuid()"
    ))
    await conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_uuid_id ON deals(uuid_id)"
    ))

    for table, fk_column in _DEPENDENT_TABLES:
        uuid_column = f"{fk_column.removesuffix('_id')}_uuid_id"
        await conn.execute(text(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {uuid_column} UUID"
        ))
        await conn.execute(text(f"""
            UPDATE {table} t SET {uuid_column} = d.uuid_id
            FROM deals d WHERE d.id = t.{fk_column} AND t.{uuid_column} IS NULL
        """))
