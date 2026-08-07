import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal
from app.db.models.deal_team import DealTeamMember
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

_TEAM_ROLES = {"Lead", "Analyst", "Associate"}


def _member_to_dict(m: DealTeamMember) -> dict:
    return {
        "team_id": str(m.team_id),
        "deal_id": str(m.deal_id),
        "team_member": m.team_member,
        "role_on_deal": m.role_on_deal,
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
    }


def _validate_role(role: Optional[str]) -> None:
    if role is not None and role not in _TEAM_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role_on_deal: {role!r}")


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/team-members")
async def list_team_members(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(select(DealTeamMember).where(DealTeamMember.deal_id == deal_id))
    return [_member_to_dict(m) for m in result.scalars().all()]


class TeamMemberRequest(BaseModel):
    team_member: str
    role_on_deal: Optional[str] = None


@router.post("/deals/{deal_id}/team-members")
async def create_team_member(deal_id: uuid.UUID, body: TeamMemberRequest, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    _validate_role(body.role_on_deal)
    member = DealTeamMember(deal_id=deal_id, **body.model_dump())
    db.add(member)
    await db.flush()
    return _member_to_dict(member)


class TeamMemberPatchRequest(BaseModel):
    team_member: Optional[str] = None
    role_on_deal: Optional[str] = None


@router.patch("/deals/{deal_id}/team-members/{team_id}")
async def patch_team_member(
    deal_id: uuid.UUID, team_id: uuid.UUID, body: TeamMemberPatchRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DealTeamMember).where(DealTeamMember.team_id == team_id, DealTeamMember.deal_id == deal_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    updates = body.model_dump(exclude_unset=True)
    if "role_on_deal" in updates:
        _validate_role(updates["role_on_deal"])
    for field, value in updates.items():
        setattr(member, field, value)
    member.updated_at = datetime.now(timezone.utc)
    return _member_to_dict(member)


@router.delete("/deals/{deal_id}/team-members/{team_id}")
async def delete_team_member(deal_id: uuid.UUID, team_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DealTeamMember).where(DealTeamMember.team_id == team_id, DealTeamMember.deal_id == deal_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    await db.delete(member)
    return {"ok": True, "team_id": str(team_id)}
