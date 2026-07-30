from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS portfolio_positions (
            id SERIAL PRIMARY KEY,
            deal_id INTEGER NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
            funded_date DATE,
            original_amount_m NUMERIC(10,2),
            current_balance_m NUMERIC(10,2),
            rate NUMERIC(6,4),
            payment_status TEXT CHECK (payment_status IS NULL OR payment_status IN ('Current', 'Late', 'Default')),
            risk TEXT CHECK (risk IS NULL OR risk IN ('Pass', 'Watch')),
            next_test_date DATE,
            covenant_status TEXT,
            leverage NUMERIC(6,2),
            dscr NUMERIC(6,2),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_portfolio_positions_deal_id ON portfolio_positions(deal_id)"))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS portfolio_monitoring_tests (
            id SERIAL PRIMARY KEY,
            portfolio_position_id INTEGER NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
            test_date DATE NOT NULL,
            leverage NUMERIC(6,2),
            dscr NUMERIC(6,2),
            fccr NUMERIC(6,2),
            covenant_status TEXT,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_portfolio_tests_position_id ON portfolio_monitoring_tests(portfolio_position_id)"
    ))

    # Stub-backfill a position for every deal already at portfolio_monitoring
    # (i.e. bucket='Closed' deals from migration 004's backfill), seeded from
    # the legacy total_funded_m figure. current_balance_m starts equal to the
    # original funded amount — real paydown history isn't in the legacy data.
    await conn.execute(text("""
        INSERT INTO portfolio_positions (deal_id, funded_date, original_amount_m, current_balance_m, payment_status, risk)
        SELECT id, target_close, total_funded_m, total_funded_m, 'Current', 'Pass'
        FROM deals
        WHERE pipeline_stage = 'portfolio_monitoring'
        ON CONFLICT (deal_id) DO NOTHING
    """))
