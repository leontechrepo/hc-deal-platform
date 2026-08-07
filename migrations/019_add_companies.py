from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # The borrower — split out from sponsors (Corporate Credit Data Model
    # v0.2), since the PE firm backing a deal and the operating company
    # borrowing against it are different entities.
    # TEXT everywhere, matching app/db/models/companies.py's Company model and
    # credit_deals' own unrestricted company_name/state/location/sector_primary/
    # subsector columns — migration 020 backfills straight from those columns,
    # so a narrower VARCHAR here (state VARCHAR(2) in particular — deals.state
    # has never been restricted to 2-letter codes) risks a value-too-long error
    # aborting the backfill on real data.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS companies (
            company_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_name TEXT NOT NULL,
            state        TEXT,
            hq_location  TEXT,
            sector       TEXT,
            subsector    TEXT,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_companies_company_name ON companies(company_name)"))
