"""Scan crash recovery, delta change tracking, and sync-state ops columns.

* email_scan_log.retry_count     - how many times an orphaned claim was re-driven
* email_scan_log.change_key      - Graph changeKey so edited messages can be re-evaluated
* email_scan_log.source_removed_at - Graph reported the message deleted/moved
* graph_sync_state.parked_at / last_resync_at / resync_count - operational visibility
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    for stmt in (
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS change_key TEXT",
        "ALTER TABLE email_scan_log ADD COLUMN IF NOT EXISTS source_removed_at TIMESTAMPTZ",
        "ALTER TABLE graph_sync_state ADD COLUMN IF NOT EXISTS parked_at TIMESTAMPTZ",
        "ALTER TABLE graph_sync_state ADD COLUMN IF NOT EXISTS last_resync_at TIMESTAMPTZ",
        "ALTER TABLE graph_sync_state ADD COLUMN IF NOT EXISTS resync_count INTEGER NOT NULL DEFAULT 0",
        "CREATE INDEX IF NOT EXISTS idx_email_scan_log_processing "
        "ON email_scan_log (processed_at) WHERE action_taken IN ('processing','retry')",
    ):
        await conn.execute(text(stmt))
