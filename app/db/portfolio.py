"""
Shared helper for stub-creating a PortfolioPosition the first time a deal
reaches portfolio_monitoring. Called from every path that can drive a deal to
that stage — the manual PATCH /api/deals/{id} path (app/api/deals.py) and the
inbox-approval path (app/api/inbox.py) — so a deal funded via either route
shows up in GET /api/portfolio.
"""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Deal
from app.db.models.portfolio import PortfolioPosition


async def ensure_portfolio_position(deal: Deal, db: AsyncSession) -> None:
    existing = await db.execute(select(PortfolioPosition).where(PortfolioPosition.deal_id == deal.id))
    if existing.scalar_one_or_none():
        return
    db.add(PortfolioPosition(
        deal_id=deal.id,
        funded_date=date.today(),
        original_amount_m=deal.deal_size_m,
        current_balance_m=deal.deal_size_m,
        rate=deal.all_in_rate,
        payment_status="Current",
        risk="Pass",
        leverage=deal.total_leverage,
        dscr=deal.dscr,
    ))
