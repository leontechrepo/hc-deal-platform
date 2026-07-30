from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

_CATEGORIES = [
    "Sourcing", "Intake", "NDA", "Screening", "LOI", "Diligence",
    "IC Memo", "Credit Agreement", "Closing",
]
_CATEGORY_LIST_SQL = ", ".join(f"'{c}'" for c in _CATEGORIES)


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS deal_documents (
            id SERIAL PRIMARY KEY,
            deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            category TEXT CHECK (category IN ({_CATEGORY_LIST_SQL})),
            doc_type TEXT,
            size_bytes BIGINT,
            storage_backend TEXT NOT NULL DEFAULT 'railway_bucket',
            storage_key TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
            uploaded_by TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deal_documents_deal_id ON deal_documents(deal_id)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deal_documents_status ON deal_documents(status)"))
