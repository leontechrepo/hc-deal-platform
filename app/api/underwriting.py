import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal
from app.db.models.underwriting import UnderwritingAssumption
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _assumption_to_dict(a: UnderwritingAssumption) -> dict:
    return {
        "underwriting_id": str(a.underwriting_id),
        "deal_id": str(a.deal_id),
        "version": a.version,
        "ebitda": a.ebitda,
        "revenue": a.revenue,
        "total_leverage_multiple": float(a.total_leverage_multiple) if a.total_leverage_multiple is not None else None,
        "senior_leverage_multiple": float(a.senior_leverage_multiple) if a.senior_leverage_multiple is not None else None,
        "interest_coverage_ratio": float(a.interest_coverage_ratio) if a.interest_coverage_ratio is not None else None,
        "base_rate": a.base_rate,
        "spread_bps": a.spread_bps,
        "oid": float(a.oid) if a.oid is not None else None,
        "ticking_fee": float(a.ticking_fee) if a.ticking_fee is not None else None,
        "maturity_date": a.maturity_date.isoformat() if a.maturity_date else None,
        "tenor_years": float(a.tenor_years) if a.tenor_years is not None else None,
        "amortization_schedule": a.amortization_schedule,
        "call_protection": a.call_protection,
        "risk_score": float(a.risk_score) if a.risk_score is not None else None,
        "scoring_weights": a.scoring_weights,
        "data_classification": a.data_classification,
        "created_at": a.created_at.isoformat(),
    }


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/underwriting-assumptions")
async def list_underwriting_assumptions(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(UnderwritingAssumption)
        .where(UnderwritingAssumption.deal_id == deal_id)
        .order_by(UnderwritingAssumption.version.desc())
    )
    return [_assumption_to_dict(a) for a in result.scalars().all()]


@router.get("/deals/{deal_id}/underwriting-assumptions/latest")
async def get_latest_underwriting_assumption(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(UnderwritingAssumption)
        .where(UnderwritingAssumption.deal_id == deal_id)
        .order_by(UnderwritingAssumption.version.desc())
        .limit(1)
    )
    assumption = result.scalar_one_or_none()
    if not assumption:
        raise HTTPException(status_code=404, detail="No underwriting assumptions recorded for this deal")
    return _assumption_to_dict(assumption)


class UnderwritingAssumptionRequest(BaseModel):
    ebitda: Optional[int] = None
    revenue: Optional[int] = None
    total_leverage_multiple: Optional[float] = None
    senior_leverage_multiple: Optional[float] = None
    interest_coverage_ratio: Optional[float] = None
    base_rate: Optional[str] = None
    spread_bps: Optional[int] = None
    oid: Optional[float] = None
    ticking_fee: Optional[float] = None
    maturity_date: Optional[date] = None
    tenor_years: Optional[float] = None
    amortization_schedule: Optional[dict] = None
    call_protection: Optional[str] = None
    risk_score: Optional[float] = None
    scoring_weights: Optional[dict] = None
    data_classification: str = "Internal"


@router.post("/deals/{deal_id}/underwriting-assumptions")
async def create_underwriting_assumption(
    deal_id: uuid.UUID, body: UnderwritingAssumptionRequest, db: AsyncSession = Depends(get_db)
):
    await _get_deal_or_404(deal_id, db)
    max_version = (
        await db.execute(
            select(UnderwritingAssumption.version)
            .where(UnderwritingAssumption.deal_id == deal_id)
            .order_by(UnderwritingAssumption.version.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    assumption = UnderwritingAssumption(deal_id=deal_id, version=(max_version or 0) + 1, **body.model_dump())
    db.add(assumption)
    await db.flush()
    return _assumption_to_dict(assumption)
