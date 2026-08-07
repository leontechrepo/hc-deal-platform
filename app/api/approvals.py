import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_actor_name, require_auth
from app.db.activity import log_activity
from app.db.models import Deal
from app.db.models.approvals import ApprovalLogEntry
from app.db.session import get_db
from app.domain.pipeline_stage import TERMINAL_STATUSES as _TERMINAL_STAGES

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

_APPROVAL_STATUSES = {"pending", "approved", "rejected"}


def _entry_to_dict(a: ApprovalLogEntry) -> dict:
    return {
        "approval_id": str(a.approval_id),
        "deal_id": str(a.deal_id) if a.deal_id else None,
        "approval_stage": a.approval_stage,
        "approver": a.approver,
        "approval_status": a.approval_status,
        "conditions": a.conditions,
        "reasoning": a.reasoning,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/approvals")
async def list_approvals(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(ApprovalLogEntry).where(ApprovalLogEntry.deal_id == deal_id).order_by(ApprovalLogEntry.created_at.desc())
    )
    return [_entry_to_dict(a) for a in result.scalars().all()]


class ApprovalRequest(BaseModel):
    approval_stage: str
    approver: Optional[str] = None
    approval_status: str = "pending"
    conditions: Optional[dict] = None
    reasoning: Optional[str] = None


@router.post("/deals/{deal_id}/approvals")
async def create_approval(
    deal_id: uuid.UUID,
    body: ApprovalRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    await _get_deal_or_404(deal_id, db)
    if body.approval_status not in _APPROVAL_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid approval_status: {body.approval_status!r}")
    if body.approval_stage in _TERMINAL_STAGES and not body.reasoning:
        raise HTTPException(status_code=400, detail="reasoning is required when approval_stage is a terminal status")

    entry = ApprovalLogEntry(deal_id=deal_id, **body.model_dump())
    db.add(entry)
    await db.flush()

    # audit_trail is superseded by deal_activity (see plan's reuse
    # decisions) — approvals also emit a unified-feed row, the same way
    # document uploads already do (app/api/deal_documents.py).
    await log_activity(
        db, deal_id, get_actor_name(auth), "approval",
        f"{body.approval_stage} — {body.approval_status}" + (f": {body.reasoning}" if body.reasoning else ""),
    )

    return _entry_to_dict(entry)
