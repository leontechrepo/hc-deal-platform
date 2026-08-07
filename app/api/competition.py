import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal
from app.db.models.competition import CompetitionAssessment
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

_COMPETITION_LEVELS = {"Low", "Medium", "High"}


def _assessment_to_dict(a: CompetitionAssessment) -> dict:
    return {
        "assessment_id": str(a.assessment_id),
        "deal_id": str(a.deal_id),
        "deal_stage": a.deal_stage,
        "competition_level": a.competition_level,
        "assessed_date": a.assessed_date.isoformat() if a.assessed_date else None,
        "notes": a.notes,
        "created_at": a.created_at.isoformat(),
    }


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/competition-assessments")
async def list_competition_assessments(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(CompetitionAssessment)
        .where(CompetitionAssessment.deal_id == deal_id)
        .order_by(CompetitionAssessment.assessed_date.desc())
    )
    return [_assessment_to_dict(a) for a in result.scalars().all()]


class CompetitionAssessmentRequest(BaseModel):
    deal_stage: Optional[str] = None
    competition_level: Optional[str] = None
    assessed_date: Optional[date] = None
    notes: Optional[str] = None


@router.post("/deals/{deal_id}/competition-assessments")
async def create_competition_assessment(
    deal_id: uuid.UUID, body: CompetitionAssessmentRequest, db: AsyncSession = Depends(get_db)
):
    await _get_deal_or_404(deal_id, db)
    if body.competition_level is not None and body.competition_level not in _COMPETITION_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid competition_level: {body.competition_level!r}")
    assessment = CompetitionAssessment(deal_id=deal_id, **body.model_dump())
    db.add(assessment)
    await db.flush()
    return _assessment_to_dict(assessment)
