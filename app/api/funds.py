from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal, Fund, FundLP
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

_FUND_STATUSES = {"Investing", "Fundraising"}


def _validate_fund_status(status: str | None) -> None:
    if status is not None and status not in _FUND_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid fund status: {status!r}")


def _lp_dict(lp: FundLP) -> dict:
    return {
        "id": lp.id,
        "fund_id": lp.fund_id,
        "name": lp.name,
        "commitment_m": float(lp.commitment_m) if lp.commitment_m is not None else None,
        "called_m": float(lp.called_m) if lp.called_m is not None else None,
    }


def _fund_deal_dict(d: Deal) -> dict:
    return {
        "id": str(d.id),
        "company_name": d.company_name,
        "pipeline_stage": d.pipeline_stage,
        "status": d.status,
        "deal_size_m": float(d.deal_size_m) if d.deal_size_m is not None else None,
        "hold_amount_m": float(d.hold_amount_m) if d.hold_amount_m is not None else None,
        "total_leverage": float(d.total_leverage) if d.total_leverage is not None else None,
        "all_in_rate": float(d.all_in_rate) if d.all_in_rate is not None else None,
    }


async def _fund_to_dict(fund: Fund, db: AsyncSession) -> dict:
    deals_res = await db.execute(select(Deal).where(Deal.fund_id == fund.id).order_by(Deal.company_name))
    deals = deals_res.scalars().all()
    lps_res = await db.execute(select(FundLP).where(FundLP.fund_id == fund.id).order_by(FundLP.name))
    lps = lps_res.scalars().all()
    return {
        "id": fund.id,
        "name": fund.name,
        "vintage": fund.vintage,
        "status": fund.status,
        "total_commitment_m": float(fund.total_commitment_m) if fund.total_commitment_m is not None else None,
        "called_capital_m": float(fund.called_capital_m) if fund.called_capital_m is not None else None,
        "deployed_capital_m": float(fund.deployed_capital_m) if fund.deployed_capital_m is not None else None,
        "available_capital_m": float(fund.available_capital_m) if fund.available_capital_m is not None else None,
        "target_return": fund.target_return,
        "strategy": fund.strategy,
        "focus_sectors": fund.focus_sectors,
        "max_single_exposure_pct": float(fund.max_single_exposure_pct) if fund.max_single_exposure_pct is not None else None,
        "target_leverage": float(fund.target_leverage) if fund.target_leverage is not None else None,
        "target_hold": fund.target_hold,
        "gp_commitment_m": float(fund.gp_commitment_m) if fund.gp_commitment_m is not None else None,
        "mgmt_fee_pct": float(fund.mgmt_fee_pct) if fund.mgmt_fee_pct is not None else None,
        "carried_interest_pct": float(fund.carried_interest_pct) if fund.carried_interest_pct is not None else None,
        "investment_period": fund.investment_period,
        "fund_life": fund.fund_life,
        "lps": [_lp_dict(lp) for lp in lps],
        "deals": [_fund_deal_dict(d) for d in deals],
    }


@router.get("/funds")
async def list_funds(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Fund).order_by(Fund.name))
    return [await _fund_to_dict(f, db) for f in result.scalars().all()]


@router.get("/funds/{fund_id}")
async def get_fund(fund_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Fund).where(Fund.id == fund_id))
    fund = result.scalar_one_or_none()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    return await _fund_to_dict(fund, db)


class FundRequest(BaseModel):
    name: str
    vintage: Optional[str] = None
    status: Optional[str] = None
    total_commitment_m: Optional[float] = None
    called_capital_m: Optional[float] = None
    deployed_capital_m: Optional[float] = None
    available_capital_m: Optional[float] = None
    target_return: Optional[str] = None
    strategy: Optional[str] = None
    focus_sectors: Optional[list[str]] = None
    max_single_exposure_pct: Optional[float] = None
    target_leverage: Optional[float] = None
    target_hold: Optional[str] = None
    gp_commitment_m: Optional[float] = None
    mgmt_fee_pct: Optional[float] = None
    carried_interest_pct: Optional[float] = None
    investment_period: Optional[str] = None
    fund_life: Optional[str] = None


@router.post("/funds")
async def create_fund(body: FundRequest, db: AsyncSession = Depends(get_db)):
    _validate_fund_status(body.status)
    fund = Fund(**body.model_dump())
    db.add(fund)
    await db.flush()
    return await _fund_to_dict(fund, db)


class FundPatchRequest(BaseModel):
    name: Optional[str] = None
    vintage: Optional[str] = None
    status: Optional[str] = None
    total_commitment_m: Optional[float] = None
    called_capital_m: Optional[float] = None
    deployed_capital_m: Optional[float] = None
    available_capital_m: Optional[float] = None
    target_return: Optional[str] = None
    strategy: Optional[str] = None
    focus_sectors: Optional[list[str]] = None
    max_single_exposure_pct: Optional[float] = None
    target_leverage: Optional[float] = None
    target_hold: Optional[str] = None
    gp_commitment_m: Optional[float] = None
    mgmt_fee_pct: Optional[float] = None
    carried_interest_pct: Optional[float] = None
    investment_period: Optional[str] = None
    fund_life: Optional[str] = None


@router.patch("/funds/{fund_id}")
async def patch_fund(fund_id: int, body: FundPatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Fund).where(Fund.id == fund_id))
    fund = result.scalar_one_or_none()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")

    updates = body.model_dump(exclude_unset=True)
    if "status" in updates:
        _validate_fund_status(updates["status"])
    for field, value in updates.items():
        setattr(fund, field, value)
    fund.updated_at = datetime.now(timezone.utc)

    return await _fund_to_dict(fund, db)


@router.delete("/funds/{fund_id}")
async def delete_fund(fund_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Fund).where(Fund.id == fund_id))
    fund = result.scalar_one_or_none()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    await db.delete(fund)
    return {"ok": True, "fund_id": fund_id}


class LPRequest(BaseModel):
    name: str
    commitment_m: Optional[float] = None
    called_m: Optional[float] = None


@router.post("/funds/{fund_id}/lps")
async def create_lp(fund_id: int, body: LPRequest, db: AsyncSession = Depends(get_db)):
    fund_res = await db.execute(select(Fund).where(Fund.id == fund_id))
    if not fund_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Fund not found")
    lp = FundLP(fund_id=fund_id, **body.model_dump())
    db.add(lp)
    await db.flush()
    return _lp_dict(lp)


class LPPatchRequest(BaseModel):
    name: Optional[str] = None
    commitment_m: Optional[float] = None
    called_m: Optional[float] = None


@router.patch("/funds/{fund_id}/lps/{lp_id}")
async def patch_lp(fund_id: int, lp_id: int, body: LPPatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FundLP).where(FundLP.id == lp_id, FundLP.fund_id == fund_id))
    lp = result.scalar_one_or_none()
    if not lp:
        raise HTTPException(status_code=404, detail="LP not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(lp, field, value)
    lp.updated_at = datetime.now(timezone.utc)
    return _lp_dict(lp)


@router.delete("/funds/{fund_id}/lps/{lp_id}")
async def delete_lp(fund_id: int, lp_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FundLP).where(FundLP.id == lp_id, FundLP.fund_id == fund_id))
    lp = result.scalar_one_or_none()
    if not lp:
        raise HTTPException(status_code=404, detail="LP not found")
    await db.delete(lp)
    return {"ok": True, "lp_id": lp_id}
