import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal
from app.db.models.screening import ScreeningMemo
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

_RECOMMENDATIONS = {"go", "no_go", "hold"}
_STATUSES = {"draft", "decided"}


def _memo_to_dict(m: ScreeningMemo) -> dict:
    return {
        "memo_id": str(m.memo_id),
        "deal_id": str(m.deal_id),
        "version": m.version,
        "recommendation": m.recommendation,
        "memo_doc_ref": m.memo_doc_ref,
        "corpus_reference": m.corpus_reference,
        "status": m.status,
        "data_classification": m.data_classification,
        "created_at": m.created_at.isoformat(),
    }


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/screening-memos")
async def list_screening_memos(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(ScreeningMemo).where(ScreeningMemo.deal_id == deal_id).order_by(ScreeningMemo.version.desc())
    )
    return [_memo_to_dict(m) for m in result.scalars().all()]


@router.get("/deals/{deal_id}/screening-memos/latest")
async def get_latest_screening_memo(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(ScreeningMemo).where(ScreeningMemo.deal_id == deal_id).order_by(ScreeningMemo.version.desc()).limit(1)
    )
    memo = result.scalar_one_or_none()
    if not memo:
        raise HTTPException(status_code=404, detail="No screening memos recorded for this deal")
    return _memo_to_dict(memo)


class ScreeningMemoRequest(BaseModel):
    recommendation: Optional[str] = None
    memo_doc_ref: Optional[str] = None
    corpus_reference: Optional[str] = None
    status: str = "draft"
    data_classification: str = "Internal"


@router.post("/deals/{deal_id}/screening-memos")
async def create_screening_memo(deal_id: uuid.UUID, body: ScreeningMemoRequest, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    if body.recommendation is not None and body.recommendation not in _RECOMMENDATIONS:
        raise HTTPException(status_code=400, detail=f"Invalid recommendation: {body.recommendation!r}")
    if body.status not in _STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status!r}")
    # max_version + insert isn't atomic — two concurrent requests for the same
    # deal can both read the same max and then race on UNIQUE(deal_id,
    # version). Retry inside a savepoint (not the whole request transaction)
    # on conflict, re-reading the max each time, rather than failing the
    # second caller's request outright.
    for attempt in range(5):
        max_version = (
            await db.execute(
                select(ScreeningMemo.version)
                .where(ScreeningMemo.deal_id == deal_id)
                .order_by(ScreeningMemo.version.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        memo = ScreeningMemo(deal_id=deal_id, version=(max_version or 0) + 1, **body.model_dump())
        db.add(memo)
        try:
            async with db.begin_nested():
                await db.flush()
        except IntegrityError:
            continue
        return _memo_to_dict(memo)
    raise HTTPException(status_code=409, detail="Could not allocate a unique version — please retry")
