from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # The borrower — split out from sponsors (Corporate Credit Data Model
    # v0.2), since the PE firm backing a deal and the operating company
    # borrowing against it are different entities.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS companies (
            company_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_name VARCHAR(255) NOT NULL,
            state        VARCHAR(2),
            hq_location  VARCHAR(255),
            sector       VARCHAR(150),
            subsector    VARCHAR(150),
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_companies_company_name ON companies(company_name)"))
