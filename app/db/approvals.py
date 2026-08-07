"""
Shared helper for writing to the approval_log feed. Called from every
deal-mutating endpoint that moves a deal's pipeline_stage or status (deals.py's
patch/update, inbox.py's approve_suggestion), so approval_log actually
reflects real transitions instead of only rows created through the
dedicated /approvals endpoint.
"""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.approvals import ApprovalLogEntry


async def log_approval(
    db: AsyncSession,
    deal_id: uuid.UUID,
    approval_stage: str,
    approver: str,
    reasoning: str | None = None,
) -> ApprovalLogEntry:
    entry = ApprovalLogEntry(
        deal_id=deal_id,
        approval_stage=approval_stage,
        approver=approver,
        approval_status="approved",
        reasoning=reasoning,
    )
    db.add(entry)
    await db.flush()
    return entry
