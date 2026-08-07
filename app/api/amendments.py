import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal
from app.db.models.amendments import Amendment
from app.db.models.approvals import ApprovalLogEntry
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _amendment_to_dict(a: Amendment) -> dict:
    return {
        "amendment_id": str(a.amendment_id),
        "deal_id": str(a.deal_id),
        "amendment_date": a.amendment_date.isoformat() if a.amendment_date else None,
        "amendment_type": a.amendment_type,
        "description": a.description,
        "approval_log_id": str(a.approval_log_id) if a.approval_log_id else None,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/amendments")
async def list_amendments(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(Amendment).where(Amendment.deal_id == deal_id).order_by(Amendment.amendment_date.desc())
    )
    return [_amendment_to_dict(a) for a in result.scalars().all()]


class AmendmentRequest(BaseModel):
    amendment_date: Optional[date] = None
    amendment_type: Optional[str] = None
    description: Optional[str] = None
    approval_log_id: Optional[uuid.UUID] = None


@router.post("/deals/{deal_id}/amendments")
async def create_amendment(deal_id: uuid.UUID, body: AmendmentRequest, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    if body.approval_log_id is not None:
        appr_res = await db.execute(
            select(ApprovalLogEntry.deal_id).where(ApprovalLogEntry.approval_id == body.approval_log_id)
        )
        appr_deal_id = appr_res.scalar_one_or_none()
        if appr_deal_id is None or str(appr_deal_id) != str(deal_id):
            raise HTTPException(status_code=400, detail="approval_log_id does not belong to this deal")
    amendment = Amendment(deal_id=deal_id, **body.model_dump())
    db.add(amendment)
    await db.flush()
    return _amendment_to_dict(amendment)
