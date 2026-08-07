"""
Shared helpers for the Deal <-> Company relationship (Corporate Credit Data
Model v0.2). Company normalizes the borrower out of Deal, but Deal keeps its
own flat company_name/location/state/sector_primary/subsector fields too
(additive, not a breaking removal — see the plan's scope note), so the two
copies have to be created and kept in sync explicitly rather than the
frontend/API just reading through a join everywhere.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.companies import Company
from app.db.models.deals import Deal


async def get_company_or_404(db: AsyncSession, company_id: uuid.UUID) -> Company:
    company = await db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


async def create_company_for_deal(
    db: AsyncSession,
    company_name: str,
    state: str | None = None,
    hq_location: str | None = None,
    sector: str | None = None,
    subsector: str | None = None,
) -> Company:
    """Called from every deal-creation path (deals.py's create_deal,
    inbox.py's approve_suggestion new-deal branch) so every deal has a
    linked Company, not just ones created through POST /deals."""
    company = Company(
        company_name=company_name,
        state=state,
        hq_location=hq_location,
        sector=sector,
        subsector=subsector,
    )
    db.add(company)
    await db.flush()
    return company


async def find_or_create_company_for_deal(
    db: AsyncSession,
    company_name: str,
    state: str | None = None,
    hq_location: str | None = None,
    sector: str | None = None,
    subsector: str | None = None,
) -> Company:
    """Reuse an existing Company for a repeat borrower (case-insensitive
    exact name match) instead of always inserting a new row — used by
    callers that only have a free-text company name, not an explicit
    company_id (create_deal's default path, inbox.py's new-deal branch)."""
    existing = (
        await db.execute(select(Company).where(func.lower(Company.company_name) == company_name.lower()).limit(1))
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    return await create_company_for_deal(db, company_name, state=state, hq_location=hq_location, sector=sector, subsector=subsector)


async def sync_deals_from_company(db: AsyncSession, company: Company) -> None:
    """Push a Company edit out to every Deal's mirrored flat fields."""
    await db.execute(
        sa_update(Deal)
        .where(Deal.company_id == company.company_id)
        .values(
            company_name=company.company_name,
            location=company.hq_location,
            state=company.state,
            sector_primary=company.sector,
            subsector=company.subsector,
        )
    )


async def sync_company_from_deal(db: AsyncSession, deal: Deal) -> None:
    """Push a Deal edit to its mirrored flat fields back to the linked Company."""
    if deal.company_id is None:
        return
    company = await db.get(Company, deal.company_id)
    if company is None:
        return
    company.company_name = deal.company_name
    company.hq_location = deal.location
    company.state = deal.state
    company.sector = deal.sector_primary
    company.subsector = deal.subsector
    company.updated_at = datetime.now(timezone.utc)
