from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

# Union of the existing taxonomy (migration 008) and the site's private-credit
# taxonomy — "Credit Agreement" already existed in both, so it isn't repeated.
_CATEGORIES = [
    "Sourcing", "Intake", "NDA", "Screening", "LOI", "Diligence",
    "IC Memo", "Credit Agreement", "Closing",
    "CIM", "QoE Report", "Management Presentation", "Term Sheet",
    "Board Consent", "Compliance Certificate",
]
_CATEGORY_LIST_SQL = ", ".join(f"'{c}'" for c in _CATEGORIES)


async def upgrade(conn: AsyncConnection) -> None:
    # Original inline CHECK (migration 008) was auto-named by Postgres as
    # deal_documents_category_check.
    await conn.execute(text("ALTER TABLE deal_documents DROP CONSTRAINT IF EXISTS deal_documents_category_check"))
    await conn.execute(text(f"""
        ALTER TABLE deal_documents ADD CONSTRAINT chk_deal_documents_category
        CHECK (category IS NULL OR category IN ({_CATEGORY_LIST_SQL}))
    """))

    # "extraction_results" per the site is folded into deal_documents, not a
    # separate table — these columns genuinely don't exist yet on this repo.
    await conn.execute(text("ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS processing_status TEXT"))
    await conn.execute(text("""
        ALTER TABLE deal_documents ADD CONSTRAINT chk_deal_documents_processing_status
        CHECK (processing_status IS NULL OR processing_status IN ('pending','extracted','needs_review'))
    """))
    await conn.execute(text("ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS extracted_data JSONB"))
    await conn.execute(text("ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC(4,3)"))
    await conn.execute(text(
        "ALTER TABLE deal_documents ADD COLUMN IF NOT EXISTS human_review_required BOOLEAN NOT NULL DEFAULT FALSE"
    ))
