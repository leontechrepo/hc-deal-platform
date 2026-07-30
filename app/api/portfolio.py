from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal, Sponsor
from app.db.models.portfolio import PortfolioMonitoringTest, PortfolioPosition
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


async def _position_to_dict(pos: PortfolioPosition, deal: Deal, db: AsyncSession) -> dict:
    sponsor_name = None
    if deal.sponsor_id:
        sp_res = await db.execute(select(Sponsor.name).where(Sponsor.id == deal.sponsor_id))
        sponsor_name = sp_res.scalar_one_or_none()
    return {
        "id": pos.id,
        "deal_id": deal.id,
        "company_name": deal.company_name,
        "sponsor_name": sponsor_name,
        "funded_date": pos.funded_date.isoformat() if pos.funded_date else None,
        "original_amount_m": float(pos.original_amount_m) if pos.original_amount_m is not None else None,
        "current_balance_m": float(pos.current_balance_m) if pos.current_balance_m is not None else None,
        "rate": float(pos.rate) if pos.rate is not None else None,
        "payment_status": pos.payment_status,
        "risk": pos.risk,
        "next_test_date": pos.next_test_date.isoformat() if pos.next_test_date else None,
        "covenant_status": pos.covenant_status,
        "leverage": float(pos.leverage) if pos.leverage is not None else None,
        "dscr": float(pos.dscr) if pos.dscr is not None else None,
    }


@router.get("/portfolio")
async def list_portfolio(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PortfolioPosition, Deal).join(Deal, PortfolioPosition.deal_id == Deal.id).order_by(Deal.company_name)
    )
    return [await _position_to_dict(pos, deal, db) for pos, deal in result.all()]


async def _get_position(deal_id: int, db: AsyncSession) -> tuple[PortfolioPosition, Deal]:
    result = await db.execute(
        select(PortfolioPosition, Deal).join(Deal, PortfolioPosition.deal_id == Deal.id).where(Deal.id == deal_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Portfolio position not found for this deal")
    return row


@router.get("/portfolio/{deal_id}")
async def get_portfolio_position(deal_id: int, db: AsyncSession = Depends(get_db)):
    pos, deal = await _get_position(deal_id, db)
    return await _position_to_dict(pos, deal, db)


_PAYMENT_STATUSES = {"Current", "Late", "Default"}
_RISK_VALUES = {"Pass", "Watch"}


class PortfolioPatchRequest(BaseModel):
    funded_date: Optional[date] = None
    original_amount_m: Optional[float] = None
    current_balance_m: Optional[float] = None
    rate: Optional[float] = None
    payment_status: Optional[str] = None
    risk: Optional[str] = None
    next_test_date: Optional[date] = None
    covenant_status: Optional[str] = None
    leverage: Optional[float] = None
    dscr: Optional[float] = None


@router.patch("/portfolio/{deal_id}")
async def patch_portfolio_position(deal_id: int, body: PortfolioPatchRequest, db: AsyncSession = Depends(get_db)):
    pos, deal = await _get_position(deal_id, db)
    updates = body.model_dump(exclude_unset=True)
    if "payment_status" in updates and updates["payment_status"] is not None and updates["payment_status"] not in _PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid payment_status: {updates['payment_status']!r}")
    if "risk" in updates and updates["risk"] is not None and updates["risk"] not in _RISK_VALUES:
        raise HTTPException(status_code=400, detail=f"Invalid risk: {updates['risk']!r}")
    for field, value in updates.items():
        setattr(pos, field, value)
    pos.updated_at = datetime.now(timezone.utc)
    return await _position_to_dict(pos, deal, db)


def _test_to_dict(t: PortfolioMonitoringTest) -> dict:
    return {
        "id": t.id,
        "portfolio_position_id": t.portfolio_position_id,
        "test_date": t.test_date.isoformat(),
        "leverage": float(t.leverage) if t.leverage is not None else None,
        "dscr": float(t.dscr) if t.dscr is not None else None,
        "fccr": float(t.fccr) if t.fccr is not None else None,
        "covenant_status": t.covenant_status,
        "notes": t.notes,
        "created_at": t.created_at.isoformat(),
    }


@router.get("/portfolio/{deal_id}/tests")
async def list_portfolio_tests(deal_id: int, db: AsyncSession = Depends(get_db)):
    pos, _ = await _get_position(deal_id, db)
    result = await db.execute(
        select(PortfolioMonitoringTest)
        .where(PortfolioMonitoringTest.portfolio_position_id == pos.id)
        .order_by(PortfolioMonitoringTest.test_date.desc())
    )
    return [_test_to_dict(t) for t in result.scalars().all()]


class PortfolioTestRequest(BaseModel):
    test_date: date
    leverage: Optional[float] = None
    dscr: Optional[float] = None
    fccr: Optional[float] = None
    covenant_status: Optional[str] = None
    notes: Optional[str] = None


@router.post("/portfolio/{deal_id}/tests")
async def create_portfolio_test(deal_id: int, body: PortfolioTestRequest, db: AsyncSession = Depends(get_db)):
    pos, _ = await _get_position(deal_id, db)
    test = PortfolioMonitoringTest(portfolio_position_id=pos.id, **body.model_dump())
    db.add(test)
    await db.flush()

    # A fresh monitoring test also refreshes the position's denormalized
    # current-state fields, so /api/portfolio's list view reflects the latest
    # test without every caller having to join tests themselves.
    if body.leverage is not None:
        pos.leverage = body.leverage
    if body.dscr is not None:
        pos.dscr = body.dscr
    if body.covenant_status is not None:
        pos.covenant_status = body.covenant_status
    pos.next_test_date = None
    pos.updated_at = datetime.now(timezone.utc)

    return _test_to_dict(test)
