from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_actor_name, require_auth
from app.db.activity import log_activity
from app.db.models import Deal
from app.db.models.activity import ACTIVITY_TYPES, DealActivity, DealNote
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


async def _get_deal_or_404(deal_id: int, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def _activity_to_dict(a: DealActivity) -> dict:
    return {
        "id": a.id,
        "deal_id": a.deal_id,
        "actor": a.actor,
        "activity_type": a.activity_type,
        "description": a.description,
        "metadata": a.metadata_json,
        "created_at": a.created_at.isoformat(),
    }


@router.get("/deals/{deal_id}/activity")
async def list_activity(deal_id: int, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(DealActivity).where(DealActivity.deal_id == deal_id).order_by(DealActivity.created_at.desc())
    )
    return [_activity_to_dict(a) for a in result.scalars().all()]


class ActivityRequest(BaseModel):
    activity_type: str
    description: str
    metadata: Optional[dict] = None


@router.post("/deals/{deal_id}/activity")
async def create_activity(
    deal_id: int,
    body: ActivityRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    await _get_deal_or_404(deal_id, db)
    if body.activity_type not in ACTIVITY_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid activity_type: {body.activity_type!r}")
    entry = await log_activity(db, deal_id, get_actor_name(auth), body.activity_type, body.description, body.metadata)
    return _activity_to_dict(entry)


def _note_to_dict(n: DealNote) -> dict:
    return {
        "id": n.id,
        "deal_id": n.deal_id,
        "author": n.author,
        "body": n.body,
        "created_at": n.created_at.isoformat(),
        "updated_at": n.updated_at.isoformat(),
    }


@router.get("/deals/{deal_id}/notes")
async def list_notes(deal_id: int, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(select(DealNote).where(DealNote.deal_id == deal_id).order_by(DealNote.created_at.desc()))
    return [_note_to_dict(n) for n in result.scalars().all()]


class NoteRequest(BaseModel):
    body: str


@router.post("/deals/{deal_id}/notes")
async def create_note(
    deal_id: int,
    body: NoteRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    await _get_deal_or_404(deal_id, db)
    author = get_actor_name(auth)
    note = DealNote(deal_id=deal_id, author=author, body=body.body)
    db.add(note)
    await db.flush()
    await log_activity(db, deal_id, author, "note", f"Note added: {body.body[:120]}")
    return _note_to_dict(note)


class NotePatchRequest(BaseModel):
    body: str


@router.patch("/notes/{note_id}")
async def patch_note(note_id: int, body: NotePatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DealNote).where(DealNote.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note.body = body.body
    note.updated_at = datetime.now(timezone.utc)
    return _note_to_dict(note)


@router.delete("/notes/{note_id}")
async def delete_note(note_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DealNote).where(DealNote.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    return {"ok": True, "note_id": note_id}
