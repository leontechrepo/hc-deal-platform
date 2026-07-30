from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal, Sponsor
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _sponsor_deal_dict(d: Deal) -> dict:
    return {
        "id": d.id,
        "company_name": d.company_name,
        "pipeline_stage": d.pipeline_stage,
        "status": d.status,
        "deal_size_m": float(d.deal_size_m) if d.deal_size_m is not None else None,
        "total_leverage": float(d.total_leverage) if d.total_leverage is not None else None,
        "all_in_rate": float(d.all_in_rate) if d.all_in_rate is not None else None,
    }


async def _sponsor_to_dict(sp: Sponsor, db: AsyncSession) -> dict:
    deals_res = await db.execute(select(Deal).where(Deal.sponsor_id == sp.id).order_by(Deal.company_name))
    deals = deals_res.scalars().all()
    active_deals = [d for d in deals if d.status == "Active"]
    # Portfolio exposure is folded in once portfolio_positions exists (migration 007).
    total_exposure = sum(float(d.deal_size_m or 0) for d in deals)
    return {
        "id": sp.id,
        "name": sp.name,
        "sponsor_type": sp.sponsor_type,
        "aum_m": float(sp.aum_m) if sp.aum_m is not None else None,
        "focus": sp.focus,
        "hq_location": sp.hq_location,
        "fund_vintage": sp.fund_vintage,
        "contact_name": sp.contact_name,
        "contact_role": sp.contact_role,
        "contact_email": sp.contact_email,
        "contact_phone": sp.contact_phone,
        "email_domain": sp.email_domain,
        "coverage_cadence": sp.coverage_cadence,
        "last_contact_date": sp.last_contact_date.isoformat() if sp.last_contact_date else None,
        "relationship_note": sp.relationship_note,
        "deals": [_sponsor_deal_dict(d) for d in deals],
        "active_deal_count": len(active_deals),
        "total_exposure_m": total_exposure,
    }


@router.get("/sponsors")
async def list_sponsors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sponsor).order_by(Sponsor.name))
    return [await _sponsor_to_dict(sp, db) for sp in result.scalars().all()]


@router.get("/sponsors/{sponsor_id}")
async def get_sponsor(sponsor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sponsor).where(Sponsor.id == sponsor_id))
    sponsor = result.scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    return await _sponsor_to_dict(sponsor, db)


class SponsorRequest(BaseModel):
    name: str
    sponsor_type: Optional[str] = None
    aum_m: Optional[float] = None
    focus: Optional[str] = None
    hq_location: Optional[str] = None
    fund_vintage: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    email_domain: Optional[str] = None
    coverage_cadence: Optional[str] = None
    last_contact_date: Optional[date] = None
    relationship_note: Optional[str] = None


_SPONSOR_TYPES = {"PE Sponsor", "Strategic"}


def _validate_sponsor_type(sponsor_type: str | None) -> None:
    if sponsor_type is not None and sponsor_type not in _SPONSOR_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid sponsor_type: {sponsor_type!r}")


@router.post("/sponsors")
async def create_sponsor(body: SponsorRequest, db: AsyncSession = Depends(get_db)):
    _validate_sponsor_type(body.sponsor_type)
    sponsor = Sponsor(**body.model_dump())
    db.add(sponsor)
    await db.flush()
    return await _sponsor_to_dict(sponsor, db)


class SponsorPatchRequest(BaseModel):
    name: Optional[str] = None
    sponsor_type: Optional[str] = None
    aum_m: Optional[float] = None
    focus: Optional[str] = None
    hq_location: Optional[str] = None
    fund_vintage: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    email_domain: Optional[str] = None
    coverage_cadence: Optional[str] = None
    last_contact_date: Optional[date] = None
    relationship_note: Optional[str] = None


@router.patch("/sponsors/{sponsor_id}")
async def patch_sponsor(sponsor_id: int, body: SponsorPatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sponsor).where(Sponsor.id == sponsor_id))
    sponsor = result.scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    updates = body.model_dump(exclude_unset=True)
    if "sponsor_type" in updates:
        _validate_sponsor_type(updates["sponsor_type"])
    for field, value in updates.items():
        setattr(sponsor, field, value)
    sponsor.updated_at = datetime.now(timezone.utc)

    return await _sponsor_to_dict(sponsor, db)


@router.delete("/sponsors/{sponsor_id}")
async def delete_sponsor(sponsor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sponsor).where(Sponsor.id == sponsor_id))
    sponsor = result.scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    await db.delete(sponsor)
    return {"ok": True, "sponsor_id": sponsor_id}
