from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

_ACTIVITY_TYPES = [
    "stage_change", "document", "note", "approval", "system", "email", "status_change",
]
_ACTIVITY_TYPE_LIST_SQL = ", ".join(f"'{t}'" for t in _ACTIVITY_TYPES)

_ACTOR_LABELS = {
    "excel_import": "Excel Import",
    "email_scan": "Email Scanner",
    "manual_edit": "Manual Edit",
}
_STAGE_CHANGE_FIELDS = {"stage", "bucket", "pipeline_stage", "status"}


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS deal_activity (
            id SERIAL PRIMARY KEY,
            deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
            actor TEXT,
            activity_type TEXT NOT NULL CHECK (activity_type IN ({_ACTIVITY_TYPE_LIST_SQL})),
            description TEXT NOT NULL,
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deal_activity_deal_id ON deal_activity(deal_id)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deal_activity_created_at ON deal_activity(created_at)"))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deal_notes (
            id SERIAL PRIMARY KEY,
            deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
            author TEXT,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deal_notes_deal_id ON deal_notes(deal_id)"))

    # Backfill deal_activity from the existing deal_update_log so the new
    # Activity tab isn't empty for deals that predate this migration.
    rows = (await conn.execute(text(
        "SELECT deal_id, field_changed, old_value, new_value, source, changed_at, email_subject FROM deal_update_log"
    ))).fetchall()

    for deal_id, field_changed, old_value, new_value, source, changed_at, email_subject in rows:
        activity_type = "stage_change" if field_changed in _STAGE_CHANGE_FIELDS else "system"
        actor = _ACTOR_LABELS.get(source, source)
        if email_subject:
            description = f"{field_changed} updated from email: {email_subject}"
        else:
            description = f"{field_changed} changed from {old_value!r} to {new_value!r}"
        await conn.execute(
            text("""
                INSERT INTO deal_activity (deal_id, actor, activity_type, description, created_at)
                VALUES (:deal_id, :actor, :activity_type, :description, :created_at)
            """),
            {
                "deal_id": deal_id,
                "actor": actor,
                "activity_type": activity_type,
                "description": description,
                "created_at": changed_at,
            },
        )
