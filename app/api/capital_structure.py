import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal
from app.db.models.capital_structure import CapitalStructure, ParticipantLender
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _tranche_to_dict(t: CapitalStructure) -> dict:
    return {
        "tranche_id": str(t.tranche_id),
        "deal_id": str(t.deal_id),
        "tranche_type": t.tranche_type,
        "holder": t.holder,
        "amount": t.amount,
        "seniority_rank": t.seniority_rank,
        "is_lcg_position": t.is_lcg_position,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }


def _lender_to_dict(p: ParticipantLender) -> dict:
    return {
        "participant_id": str(p.participant_id),
        "deal_id": str(p.deal_id),
        "lender_name": p.lender_name,
        "participation_amount": p.participation_amount,
        "is_agent": p.is_agent,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/capital-structure")
async def list_capital_structure(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(select(CapitalStructure).where(CapitalStructure.deal_id == deal_id))
    return [_tranche_to_dict(t) for t in result.scalars().all()]


class TrancheRequest(BaseModel):
    tranche_type: Optional[str] = None
    holder: Optional[str] = None
    amount: Optional[int] = None
    seniority_rank: Optional[int] = None
    is_lcg_position: bool = False


@router.post("/deals/{deal_id}/capital-structure")
async def create_tranche(deal_id: uuid.UUID, body: TrancheRequest, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    tranche = CapitalStructure(deal_id=deal_id, **body.model_dump())
    db.add(tranche)
    await db.flush()
    return _tranche_to_dict(tranche)


class TranchePatchRequest(BaseModel):
    tranche_type: Optional[str] = None
    holder: Optional[str] = None
    amount: Optional[int] = None
    seniority_rank: Optional[int] = None
    is_lcg_position: Optional[bool] = None


@router.patch("/deals/{deal_id}/capital-structure/{tranche_id}")
async def patch_tranche(
    deal_id: uuid.UUID, tranche_id: uuid.UUID, body: TranchePatchRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CapitalStructure).where(CapitalStructure.tranche_id == tranche_id, CapitalStructure.deal_id == deal_id)
    )
    tranche = result.scalar_one_or_none()
    if not tranche:
        raise HTTPException(status_code=404, detail="Tranche not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tranche, field, value)
    tranche.updated_at = datetime.now(timezone.utc)
    return _tranche_to_dict(tranche)


@router.delete("/deals/{deal_id}/capital-structure/{tranche_id}")
async def delete_tranche(deal_id: uuid.UUID, tranche_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CapitalStructure).where(CapitalStructure.tranche_id == tranche_id, CapitalStructure.deal_id == deal_id)
    )
    tranche = result.scalar_one_or_none()
    if not tranche:
        raise HTTPException(status_code=404, detail="Tranche not found")
    await db.delete(tranche)
    return {"ok": True, "tranche_id": str(tranche_id)}


@router.get("/deals/{deal_id}/participant-lenders")
async def list_participant_lenders(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(select(ParticipantLender).where(ParticipantLender.deal_id == deal_id))
    return [_lender_to_dict(p) for p in result.scalars().all()]


class ParticipantLenderRequest(BaseModel):
    lender_name: str
    participation_amount: Optional[int] = None
    is_agent: bool = False


@router.post("/deals/{deal_id}/participant-lenders")
async def create_participant_lender(
    deal_id: uuid.UUID, body: ParticipantLenderRequest, db: AsyncSession = Depends(get_db)
):
    await _get_deal_or_404(deal_id, db)
    lender = ParticipantLender(deal_id=deal_id, **body.model_dump())
    db.add(lender)
    await db.flush()
    return _lender_to_dict(lender)


class ParticipantLenderPatchRequest(BaseModel):
    lender_name: Optional[str] = None
    participation_amount: Optional[int] = None
    is_agent: Optional[bool] = None


@router.patch("/deals/{deal_id}/participant-lenders/{participant_id}")
async def patch_participant_lender(
    deal_id: uuid.UUID,
    participant_id: uuid.UUID,
    body: ParticipantLenderPatchRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ParticipantLender).where(
            ParticipantLender.participant_id == participant_id, ParticipantLender.deal_id == deal_id
        )
    )
    lender = result.scalar_one_or_none()
    if not lender:
        raise HTTPException(status_code=404, detail="Participant lender not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(lender, field, value)
    lender.updated_at = datetime.now(timezone.utc)
    return _lender_to_dict(lender)


@router.delete("/deals/{deal_id}/participant-lenders/{participant_id}")
async def delete_participant_lender(deal_id: uuid.UUID, participant_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ParticipantLender).where(
            ParticipantLender.participant_id == participant_id, ParticipantLender.deal_id == deal_id
        )
    )
    lender = result.scalar_one_or_none()
    if not lender:
        raise HTTPException(status_code=404, detail="Participant lender not found")
    await db.delete(lender)
    return {"ok": True, "participant_id": str(participant_id)}
