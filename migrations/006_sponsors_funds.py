from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS sponsors (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            sponsor_type TEXT CHECK (sponsor_type IS NULL OR sponsor_type IN ('PE Sponsor', 'Strategic')),
            aum_m NUMERIC(12,2),
            focus TEXT,
            hq_location TEXT,
            fund_vintage TEXT,
            contact_name TEXT,
            contact_role TEXT,
            contact_email TEXT,
            contact_phone TEXT,
            email_domain TEXT,
            coverage_cadence TEXT,
            last_contact_date DATE,
            relationship_note TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_sponsors_name ON sponsors(name)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_sponsors_email_domain ON sponsors(email_domain)"))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS funds (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            vintage TEXT,
            status TEXT CHECK (status IS NULL OR status IN ('Investing', 'Fundraising')),
            total_commitment_m NUMERIC(12,2),
            called_capital_m NUMERIC(12,2),
            deployed_capital_m NUMERIC(12,2),
            available_capital_m NUMERIC(12,2),
            target_return TEXT,
            strategy TEXT,
            focus_sectors TEXT[],
            max_single_exposure_pct NUMERIC(6,2),
            target_leverage NUMERIC(6,2),
            target_hold TEXT,
            gp_commitment_m NUMERIC(12,2),
            mgmt_fee_pct NUMERIC(6,4),
            carried_interest_pct NUMERIC(6,4),
            investment_period TEXT,
            fund_life TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_funds_name ON funds(name)"))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS fund_lps (
            id SERIAL PRIMARY KEY,
            fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            commitment_m NUMERIC(12,2),
            called_m NUMERIC(12,2),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fund_lps_fund_id ON fund_lps(fund_id)"))

    await conn.execute(text("ALTER TABLE deals ADD COLUMN IF NOT EXISTS sponsor_id INTEGER REFERENCES sponsors(id) ON DELETE SET NULL"))
    await conn.execute(text("ALTER TABLE deals ADD COLUMN IF NOT EXISTS fund_id INTEGER REFERENCES funds(id) ON DELETE SET NULL"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deals_sponsor_id ON deals(sponsor_id)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deals_fund_id ON deals(fund_id)"))
