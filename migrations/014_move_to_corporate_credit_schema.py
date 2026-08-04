from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

TABLES = [
    "deals", "deal_update_log", "pending_suggestions", "email_scan_log",
    "sponsors", "funds", "fund_lps",
    "portfolio_positions", "portfolio_monitoring_tests",
    "deal_documents", "deal_activity", "deal_notes",
    "deal_timeline_workstreams", "deal_timeline_tasks",
    "chat_sessions", "chat_messages",
    "schema_migrations",
]


async def upgrade(conn: AsyncConnection) -> None:
    # Dedicated schema so this Postgres instance can host other, unrelated business
    # systems side by side without colliding in `public`. ALTER TABLE ... SET SCHEMA
    # is metadata-only (no data copy/rewrite) and FKs/indexes/constraints move with
    # their table automatically, regardless of order.
    #
    # Guarded per table (not a blind ALTER) rather than assumed-present in `public`:
    # a fresh database bootstraps straight into `corporate_credit` (see runner.py)
    # and never has these tables in `public` at all, and this stays a safe no-op if
    # `corporate_credit` was somehow created ahead of the actual move.
    await conn.execute(text("CREATE SCHEMA IF NOT EXISTS corporate_credit"))
    for table in TABLES:
        still_in_public = (await conn.execute(
            text("SELECT to_regclass(:qualified) IS NOT NULL"),
            {"qualified": f"public.{table}"},
        )).scalar()
        if still_in_public:
            await conn.execute(text(f"ALTER TABLE public.{table} SET SCHEMA corporate_credit"))
