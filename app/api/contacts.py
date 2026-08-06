import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models.contacts import Contact
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

_CONTACT_ROLES = {
    "CEO", "CFO", "COO", "Board Member", "Sponsor Partner",
    "Banker/Intermediary", "Legal Counsel", "Auditor/QoE Provider",
}


def _contact_to_dict(c: Contact) -> dict:
    return {
        "contact_id": str(c.contact_id),
        "company_id": str(c.company_id) if c.company_id else None,
        "sponsor_id": c.sponsor_id,
        "deal_id": str(c.deal_id) if c.deal_id else None,
        "name": c.name,
        "email": c.email,
        "role": c.role,
        "cadence_frequency": c.cadence_frequency,
        "last_interaction_date": c.last_interaction_date.isoformat() if c.last_interaction_date else None,
        "next_touchpoint_due": c.next_touchpoint_due.isoformat() if c.next_touchpoint_due else None,
        "draft_followup_ref": c.draft_followup_ref,
        "data_classification": c.data_classification,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }


def _validate_role(role: Optional[str]) -> None:
    if role is not None and role not in _CONTACT_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role!r}")


@router.get("/deals/{deal_id}/contacts")
async def list_deal_contacts(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contact).where(Contact.deal_id == deal_id).order_by(Contact.name))
    return [_contact_to_dict(c) for c in result.scalars().all()]


@router.get("/companies/{company_id}/contacts")
async def list_company_contacts(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contact).where(Contact.company_id == company_id).order_by(Contact.name))
    return [_contact_to_dict(c) for c in result.scalars().all()]


class ContactRequest(BaseModel):
    company_id: Optional[uuid.UUID] = None
    sponsor_id: Optional[int] = None
    deal_id: Optional[uuid.UUID] = None
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    cadence_frequency: Optional[str] = None
    last_interaction_date: Optional[date] = None
    next_touchpoint_due: Optional[date] = None
    draft_followup_ref: Optional[str] = None


@router.post("/contacts")
async def create_contact(body: ContactRequest, db: AsyncSession = Depends(get_db)):
    _validate_role(body.role)
    contact = Contact(**body.model_dump())
    db.add(contact)
    await db.flush()
    return _contact_to_dict(contact)


class ContactPatchRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    cadence_frequency: Optional[str] = None
    last_interaction_date: Optional[date] = None
    next_touchpoint_due: Optional[date] = None
    draft_followup_ref: Optional[str] = None


@router.patch("/contacts/{contact_id}")
async def patch_contact(contact_id: uuid.UUID, body: ContactPatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contact).where(Contact.contact_id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    updates = body.model_dump(exclude_unset=True)
    if "role" in updates:
        _validate_role(updates["role"])
    for field, value in updates.items():
        setattr(contact, field, value)
    contact.updated_at = datetime.now(timezone.utc)
    return _contact_to_dict(contact)
