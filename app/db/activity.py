"""
Shared helper for writing to the deal_activity feed. Called from every
deal-mutating endpoint (patch/create, documents, notes, timeline) so the
Activity tab is a genuine unified feed rather than something maintained
ad hoc per route.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.activity import DealActivity


async def log_activity(
    db: AsyncSession,
    deal_id: int,
    actor: str,
    activity_type: str,
    description: str,
    metadata: dict | None = None,
) -> DealActivity:
    entry = DealActivity(
        deal_id=deal_id,
        actor=actor,
        activity_type=activity_type,
        description=description,
        metadata_json=metadata,
    )
    db.add(entry)
    await db.flush()
    return entry
