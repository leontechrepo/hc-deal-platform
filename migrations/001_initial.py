from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deals (
            id SERIAL PRIMARY KEY,
            company_name TEXT NOT NULL,
            location TEXT,
            bucket TEXT,
            stage TEXT,
            sector_primary TEXT,
            sector_full TEXT,
            subsector TEXT,
            deal_size_m NUMERIC(10,2),
            security TEXT,
            uop TEXT,
            source TEXT,
            timing_qtr TEXT,
            competition TEXT,
            nda TEXT,
            dataroom TEXT,
            mgmt_meeting TEXT,
            ioi_offered TEXT,
            ioi_signed TEXT,
            target_close DATE,
            commentary TEXT,
            last_updated DATE,
            ltm_revenue_m NUMERIC(10,3),
            ltm_ebitda_m NUMERIC(10,3),
            ebitda_margin NUMERIC(6,4),
            committed_upfront_m NUMERIC(10,2),
            committed_ddtl_m NUMERIC(10,2),
            total_funded_m NUMERIC(10,2),
            cash_int_pct NUMERIC(6,4),
            pik_int_pct NUMERIC(6,4),
            total_int_pct NUMERIC(6,4),
            reasons_for_passing TEXT,
            updated_by TEXT NOT NULL DEFAULT 'excel_import',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deal_update_log (
            id SERIAL PRIMARY KEY,
            deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
            field_changed TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            source TEXT NOT NULL,
            changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            email_subject TEXT
        )
    """))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS email_scan_log (
            id SERIAL PRIMARY KEY,
            graph_message_id TEXT NOT NULL UNIQUE,
            user_email TEXT NOT NULL,
            subject TEXT,
            received_at TIMESTAMPTZ,
            matched_deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
            claude_summary TEXT,
            processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            action_taken TEXT
        )
    """))

    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deals_bucket ON deals(bucket)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deals_sector_primary ON deals(sector_primary)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dul_deal_id ON deal_update_log(deal_id)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dul_changed_at ON deal_update_log(changed_at)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_esl_received_at ON email_scan_log(received_at)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_esl_matched_deal_id ON email_scan_log(matched_deal_id)"))
