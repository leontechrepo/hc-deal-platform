from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    # Some pending_suggestions rows have a raw-HTML email_snippet (the scanner used to
    # truncate Graph's HTML body.content instead of its plain-text bodyPreview). The
    # first 200 chars of an HTML email is almost always head/meta boilerplate, so there's
    # no readable text worth salvaging — clear it so the UI just omits the snippet.
    await conn.execute(text(
        "UPDATE pending_suggestions SET email_snippet = NULL "
        "WHERE email_snippet ~* '<html|<!doctype|<head[ >]'"
    ))

    # Pre-existing deal_update_log rows recorded a "change" even when old_value equaled
    # new_value (e.g. re-saving a field unchanged) — a real bug, not a real change, so
    # these rows are noise rather than history worth keeping.
    await conn.execute(text(
        "DELETE FROM deal_update_log WHERE old_value IS NOT DISTINCT FROM new_value"
    ))
