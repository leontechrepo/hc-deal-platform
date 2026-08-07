import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal
from app.db.models.risk_ratings import RiskRating
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _rating_to_dict(r: RiskRating) -> dict:
    return {
        "rating_id": str(r.rating_id),
        "deal_id": str(r.deal_id),
        "rating_date": r.rating_date.isoformat(),
        "risk_grade": r.risk_grade,
        "rationale": r.rationale,
        "created_at": r.created_at.isoformat(),
    }


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/risk-ratings")
async def list_risk_ratings(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(RiskRating).where(RiskRating.deal_id == deal_id).order_by(RiskRating.rating_date.desc())
    )
    return [_rating_to_dict(r) for r in result.scalars().all()]


class RiskRatingRequest(BaseModel):
    rating_date: date
    risk_grade: Optional[str] = None
    rationale: Optional[str] = None


@router.post("/deals/{deal_id}/risk-ratings")
async def create_risk_rating(deal_id: uuid.UUID, body: RiskRatingRequest, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    rating = RiskRating(deal_id=deal_id, **body.model_dump())
    db.add(rating)
    await db.flush()
    return _rating_to_dict(rating)
