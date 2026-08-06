from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # Reuse, not a new covenant_test_results table: portfolio_monitoring_tests
    # already stores exactly this concept (a dated leverage/DSCR/FCCR/
    # covenant_status test result) — it's just anchored to a
    # portfolio_position_id rather than a specific covenant. This lets a test
    # optionally tie to one, without forking the workflow into two tables.
    await conn.execute(text(
        "ALTER TABLE portfolio_monitoring_tests ADD COLUMN IF NOT EXISTS covenant_id "
        "UUID REFERENCES covenants(covenant_id) ON DELETE SET NULL"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_portfolio_monitoring_tests_covenant_id "
        "ON portfolio_monitoring_tests(covenant_id)"
    ))
