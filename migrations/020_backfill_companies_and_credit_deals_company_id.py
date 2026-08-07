from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # Nullable, no UNIQUE — today it's 1:1 with an existing deal, but future
    # deals (add-ons, refinancings of the same portfolio company) may
    # legitimately share one companies row.
    await conn.execute(text(
        "ALTER TABLE credit_deals ADD COLUMN IF NOT EXISTS company_id "
        "UUID REFERENCES companies(company_id) ON DELETE SET NULL"
    ))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_credit_deals_company_id ON credit_deals(company_id)"))

    # Backfill: one companies row per existing credit_deals row that doesn't
    # have one yet. A temp table holds the generated UUID so the same value
    # is used for both the INSERT and the back-reference UPDATE.
    await conn.execute(text("""
        CREATE TEMP TABLE _company_backfill ON COMMIT DROP AS
        SELECT id AS deal_id, gen_random_uuid() AS company_id,
               company_name, state, location AS hq_location,
               sector_primary AS sector, subsector
        FROM credit_deals
        WHERE company_id IS NULL
    """))
    await conn.execute(text("""
        INSERT INTO companies (company_id, company_name, state, hq_location, sector, subsector)
        SELECT company_id, company_name, state, hq_location, sector, subsector FROM _company_backfill
    """))
    await conn.execute(text("""
        UPDATE credit_deals cd SET company_id = b.company_id
        FROM _company_backfill b WHERE cd.id = b.deal_id
    """))
