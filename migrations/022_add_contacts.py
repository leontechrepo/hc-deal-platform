from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE contact_role_enum AS ENUM (
                'CEO','CFO','COO','Board Member','Sponsor Partner',
                'Banker/Intermediary','Legal Counsel','Auditor/QoE Provider'
            );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    # Reused by underwriting_assumptions (027) and screening_memos (028) —
    # created here as the first consumer, never recreated afterward.
    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE data_classification_enum AS ENUM ('Internal','PII','MNPI','LP');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))

    # Links to a company, a sponsor, or a specific deal — all nullable and
    # independent (a CFO ties to the company generally; a banker contact can
    # tie to one deal specifically).
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS contacts (
            contact_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id            UUID REFERENCES companies(company_id) ON DELETE SET NULL,
            sponsor_id            INTEGER REFERENCES sponsors(id) ON DELETE SET NULL,
            deal_id               UUID REFERENCES credit_deals(id) ON DELETE SET NULL,
            name                  VARCHAR(255) NOT NULL,
            email                 VARCHAR(255),
            role                  contact_role_enum,
            cadence_frequency     VARCHAR(50),
            last_interaction_date DATE,
            next_touchpoint_due   DATE,
            draft_followup_ref    TEXT,
            data_classification   data_classification_enum NOT NULL DEFAULT 'PII',
            created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_contacts_sponsor_id ON contacts(sponsor_id)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_contacts_deal_id ON contacts(deal_id)"))
