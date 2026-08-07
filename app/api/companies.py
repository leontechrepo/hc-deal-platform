import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.companies import sync_deals_from_company
from app.db.models.companies import Company
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _company_to_dict(c: Company) -> dict:
    return {
        "company_id": str(c.company_id),
        "company_name": c.company_name,
        "state": c.state,
        "hq_location": c.hq_location,
        "sector": c.sector,
        "subsector": c.subsector,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }


@router.get("/companies")
async def list_companies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).order_by(Company.company_name))
    return [_company_to_dict(c) for c in result.scalars().all()]


@router.get("/companies/{company_id}")
async def get_company(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).where(Company.company_id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return _company_to_dict(company)


class CompanyRequest(BaseModel):
    company_name: str
    state: Optional[str] = None
    hq_location: Optional[str] = None
    sector: Optional[str] = None
    subsector: Optional[str] = None


@router.post("/companies")
async def create_company(body: CompanyRequest, db: AsyncSession = Depends(get_db)):
    company = Company(**body.model_dump())
    db.add(company)
    await db.flush()
    return _company_to_dict(company)


class CompanyPatchRequest(BaseModel):
    company_name: Optional[str] = None
    state: Optional[str] = None
    hq_location: Optional[str] = None
    sector: Optional[str] = None
    subsector: Optional[str] = None


@router.patch("/companies/{company_id}")
async def patch_company(company_id: uuid.UUID, body: CompanyPatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).where(Company.company_id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(company, field, value)
    company.updated_at = datetime.now(timezone.utc)
    if updates:
        await sync_deals_from_company(db, company)
    return _company_to_dict(company)
