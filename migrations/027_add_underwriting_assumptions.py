from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # Versioned, append-only history layered alongside the existing flat
    # one-shot underwriting fields already on credit_deals (left untouched —
    # additive only). "Never delete prior versions": UNIQUE(deal_id, version)
    # plus app-layer version assignment, no DB trigger needed at this scale.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS underwriting_assumptions (
            underwriting_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id                  UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            version                  INTEGER NOT NULL,
            ebitda                   BIGINT,
            revenue                  BIGINT,
            total_leverage_multiple  DECIMAL(5,2),
            senior_leverage_multiple DECIMAL(5,2),
            interest_coverage_ratio  DECIMAL(5,2),
            base_rate                VARCHAR(20),
            spread_bps               INTEGER,
            oid                      DECIMAL(5,4),
            ticking_fee              DECIMAL(5,4),
            maturity_date            DATE,
            tenor_years              DECIMAL,
            amortization_schedule    JSONB,
            call_protection          VARCHAR(255),
            risk_score               DECIMAL,
            scoring_weights          JSONB,
            data_classification      data_classification_enum NOT NULL DEFAULT 'Internal',
            created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (deal_id, version)
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_underwriting_assumptions_deal_id ON underwriting_assumptions(deal_id)"
    ))
