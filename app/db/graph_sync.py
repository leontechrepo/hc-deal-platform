"""Reading and advancing the Graph delta watermark."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.graph_sync import GraphSyncState

logger = logging.getLogger(__name__)

MAX_CONSECUTIVE_FAILURES = 5


async def get_or_create_sync_state(
    db: AsyncSession, *, user_email: str, folder: str
) -> GraphSyncState:
    row = (
        await db.execute(
            select(GraphSyncState).where(
                GraphSyncState.user_email == user_email,
                GraphSyncState.folder == folder,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = GraphSyncState(user_email=user_email, folder=folder)
        db.add(row)
        await db.flush()
    return row


async def advance_watermark(
    db: AsyncSession,
    state: GraphSyncState,
    *,
    next_link: str | None,
    delta_link: str | None,
) -> None:
    state.next_link = next_link
    if delta_link:
        state.delta_link = delta_link
        state.next_link = None
    state.last_synced_at = datetime.now(timezone.utc)
    state.last_error = None
    state.consecutive_failures = 0
    state.parked_at = None
    await db.flush()


async def record_failure(
    db: AsyncSession, state: GraphSyncState, *, error: str
) -> None:
    state.last_error = error[:1000]
    state.consecutive_failures += 1
    await db.flush()
    if state.consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
        if state.parked_at is None:
            state.parked_at = datetime.now(timezone.utc)
        logger.error(
            "Graph sync for %s/%s has failed %d times consecutively and is now "
            "parked; clear consecutive_failures to resume. Last error: %s",
            state.user_email, state.folder, state.consecutive_failures, error[:200],
        )


async def reset_for_resync(
    db: AsyncSession, state: GraphSyncState, *, reason: str
) -> None:
    logger.warning(
        "Resetting Graph delta state for %s/%s: %s",
        state.user_email, state.folder, reason,
    )
    state.delta_link = None
    state.next_link = None
    state.last_error = reason[:1000]
    state.last_resync_at = datetime.now(timezone.utc)
    state.resync_count = (state.resync_count or 0) + 1
    await db.flush()


async def unpark(db: AsyncSession, state: GraphSyncState, *, resync: bool = False) -> None:
    """Operator action: clear the failure streak (optionally forcing a full resync)."""
    state.consecutive_failures = 0
    state.parked_at = None
    if resync:
        await reset_for_resync(db, state, reason="operator-requested resync")
    await db.flush()


def is_parked(state: GraphSyncState) -> bool:
    return state.consecutive_failures >= MAX_CONSECUTIVE_FAILURES
