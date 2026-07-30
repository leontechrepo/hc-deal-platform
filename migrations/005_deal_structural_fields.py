from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

# Purely additive structural/financial/covenant fields for the new UI's Deal
# Detail / New Deal modal screens. All nullable, no backfill — populated going
# forward via the New Deal modal and Underwriting tab edits.
_NEW_COLUMNS = """
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS state TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS next_action TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS sourcing_date DATE;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_name TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_role TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS nda_date DATE;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS nda_status TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS tenor_months INTEGER;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS amortization TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS oid_pct NUMERIC(6,4);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS sofr_floor_pct NUMERIC(6,4);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS call_protection TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS maturity_date DATE;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS total_leverage NUMERIC(6,2);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS spread_bps INTEGER;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS base_rate TEXT;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS sofr_rate NUMERIC(6,4);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS all_in_rate NUMERIC(6,4);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS hold_amount_m NUMERIC(10,2);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS revenue_growth_pct NUMERIC(6,4);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS ebitda_growth_pct NUMERIC(6,4);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS capex_m NUMERIC(10,3);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS fcf_m NUMERIC(10,3);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS dscr NUMERIC(6,2);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS fccr NUMERIC(6,2);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS interest_coverage NUMERIC(6,2);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS max_leverage_covenant NUMERIC(6,2);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS min_fccr_covenant NUMERIC(6,2);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS capex_limit_covenant_m NUMERIC(10,3);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS employees INTEGER;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS locations_count INTEGER;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS year_founded INTEGER;
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS risk_score NUMERIC(4,1);
    ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_team TEXT[];
"""


async def upgrade(conn: AsyncConnection) -> None:
    for stmt in _NEW_COLUMNS.strip().split(";"):
        stmt = stmt.strip()
        if stmt:
            await conn.execute(text(stmt))

    await conn.execute(text("""
        ALTER TABLE deals ADD CONSTRAINT chk_deals_nda_status
        CHECK (nda_status IS NULL OR nda_status IN ('Not Started', 'Sent', 'Signed'))
    """))
