import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal
from app.db.models.covenants import Covenant
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

_COVENANT_TYPES = {"Financial", "Negative", "Affirmative"}
_TEST_FREQUENCIES = {"Quarterly", "Monthly", "Annual"}


def _covenant_to_dict(c: Covenant) -> dict:
    return {
        "covenant_id": str(c.covenant_id),
        "deal_id": str(c.deal_id),
        "covenant_type": c.covenant_type,
        "covenant_name": c.covenant_name,
        "threshold_value": float(c.threshold_value) if c.threshold_value is not None else None,
        "test_frequency": c.test_frequency,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def _validate(covenant_type: str, threshold_value: Optional[float], test_frequency: Optional[str]) -> None:
    if covenant_type not in _COVENANT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid covenant_type: {covenant_type!r}")
    if threshold_value is not None and covenant_type != "Financial":
        raise HTTPException(status_code=400, detail="threshold_value is only valid for Financial covenants")
    if test_frequency is not None and test_frequency not in _TEST_FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"Invalid test_frequency: {test_frequency!r}")


@router.get("/deals/{deal_id}/covenants")
async def list_covenants(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(select(Covenant).where(Covenant.deal_id == deal_id))
    return [_covenant_to_dict(c) for c in result.scalars().all()]


class CovenantRequest(BaseModel):
    covenant_type: str
    covenant_name: str
    threshold_value: Optional[float] = None
    test_frequency: Optional[str] = None


@router.post("/deals/{deal_id}/covenants")
async def create_covenant(deal_id: uuid.UUID, body: CovenantRequest, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    _validate(body.covenant_type, body.threshold_value, body.test_frequency)
    covenant = Covenant(deal_id=deal_id, **body.model_dump())
    db.add(covenant)
    await db.flush()
    return _covenant_to_dict(covenant)


class CovenantPatchRequest(BaseModel):
    covenant_type: Optional[str] = None
    covenant_name: Optional[str] = None
    threshold_value: Optional[float] = None
    test_frequency: Optional[str] = None


@router.patch("/deals/{deal_id}/covenants/{covenant_id}")
async def patch_covenant(
    deal_id: uuid.UUID, covenant_id: uuid.UUID, body: CovenantPatchRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Covenant).where(Covenant.covenant_id == covenant_id, Covenant.deal_id == deal_id)
    )
    covenant = result.scalar_one_or_none()
    if not covenant:
        raise HTTPException(status_code=404, detail="Covenant not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(covenant, field, value)
    _validate(covenant.covenant_type, covenant.threshold_value, covenant.test_frequency)
    covenant.updated_at = datetime.now(timezone.utc)
    return _covenant_to_dict(covenant)
