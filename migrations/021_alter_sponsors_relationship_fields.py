from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # Genuinely missing on the existing sponsors table — contact_name/
    # contact_role are the sponsor's OWN contact, and relationship_note is a
    # generic freeform field, neither of which covers "which of our staff
    # owns this relationship" or "narrative history of deals with them".
    await conn.execute(text("ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS relationship_owner TEXT"))
    await conn.execute(text("ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS deal_history_summary TEXT"))
