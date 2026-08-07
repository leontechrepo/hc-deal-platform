from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # Site's vocabulary renames 'Late' -> 'Past Due' and adds 'PIK'. The
    # original inline CHECK (migration 007) was auto-named by Postgres as
    # portfolio_positions_payment_status_check.
    await conn.execute(text(
        "ALTER TABLE portfolio_positions DROP CONSTRAINT IF EXISTS portfolio_positions_payment_status_check"
    ))
    await conn.execute(text("UPDATE portfolio_positions SET payment_status = 'Past Due' WHERE payment_status = 'Late'"))
    await conn.execute(text("""
        ALTER TABLE portfolio_positions ADD CONSTRAINT chk_portfolio_positions_payment_status
        CHECK (payment_status IS NULL OR payment_status IN ('Current','PIK','Past Due','Default'))
    """))

    # Exit/repayment tracking — v0.1 didn't track loan repayment at all.
    await conn.execute(text("ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS repayment_date DATE"))
    await conn.execute(text("ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS repayment_type TEXT"))
    await conn.execute(text("""
        ALTER TABLE portfolio_positions ADD CONSTRAINT chk_portfolio_positions_repayment_type
        CHECK (repayment_type IS NULL OR repayment_type IN ('maturity','prepayment','refinance','restructuring','write_off'))
    """))
    await conn.execute(text("ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS realized_irr NUMERIC(6,4)"))
    await conn.execute(text("ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS moic NUMERIC(6,2)"))
