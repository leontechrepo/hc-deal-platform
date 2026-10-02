"""Document extraction runs, reviewable candidates, and reviewer actions."""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_actor_name, require_auth
from app.core.config import settings
from app.db.activity import log_activity
from app.db.models.deals import Deal, DealUpdateLog
from app.db.models.documents import (
    CANDIDATE_NEEDS_REVIEW,
    DealDocument,
    DealExtractionCandidate,
    DealExtractionRun,
)
from app.db.session import get_db
from app.domain.field_updates import FieldContext, validate_field_update
from app.domain.pipeline_stage import UNDERWRITING_FIELDS, is_underwriting_locked

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _candidate_dict(c: DealExtractionCandidate, doc_name: str | None) -> dict[str, Any]:
    return {
        "id": str(c.id),
        "run_id": str(c.run_id),
        "deal_id": str(c.deal_id),
        "document_id": c.document_id,
        "document_name": doc_name,
        "field": c.field,
        "value": c.raw_value,
        "display_value": c.display_value,
        "confidence": float(c.confidence),
        "evidence": c.evidence,
        "status": c.status,
        "reason": c.reason,
        "current_value": c.current_value,
        "needs_review": c.status in CANDIDATE_NEEDS_REVIEW,
        "reviewed_by": c.reviewed_by,
        "reviewed_at": _iso(c.reviewed_at),
        "review_note": c.review_note,
        "created_at": _iso(c.created_at),
    }


def _run_dict(run: DealExtractionRun) -> dict[str, Any]:
    return {
        "id": str(run.id),
        "deal_id": str(run.deal_id),
        "suggestion_id": run.suggestion_id,
        "status": run.status,
        "trigger": run.trigger,
        "requested_by": run.requested_by,
        "document_ids": run.document_ids,
        "retry_count": run.retry_count,
        "input_tokens": run.input_tokens,
        "output_tokens": run.output_tokens,
        "estimated_cost_usd": float(run.estimated_cost_usd or 0),
        "model": run.model,
        "extracted_fields": run.extracted_fields,
        "applied_fields": run.applied_fields,
        "applied_field_count": run.applied_field_count,
        "low_confidence_fields": run.low_confidence_fields,
        "conflicts": run.conflicts,
        "document_errors": run.document_errors,
        "last_error": run.last_error,
        "started_at": _iso(run.started_at),
        "finished_at": _iso(run.finished_at),
        "created_at": _iso(run.created_at),
    }


async def _doc_names(db: AsyncSession, ids: set[int | None]) -> dict[int, str]:
    real = [i for i in ids if i is not None]
    if not real:
        return {}
    rows = (await db.execute(select(DealDocument.id, DealDocument.name).where(DealDocument.id.in_(real)))).all()
    return {i: n for i, n in rows}


@router.get("/deal-extractions/{run_id}")
async def get_extraction_run(run_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    run = await db.get(DealExtractionRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Extraction run not found")
    cands = list(
        (await db.execute(
            select(DealExtractionCandidate)
            .where(DealExtractionCandidate.run_id == run_id)
            .order_by(DealExtractionCandidate.field, DealExtractionCandidate.created_at)
        )).scalars().all()
    )
    names = await _doc_names(db, {c.document_id for c in cands})
    return {**_run_dict(run), "candidates": [_candidate_dict(c, names.get(c.document_id)) for c in cands]}


@router.get("/deals/{deal_id}/extractions")
async def list_deal_extractions(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Everything the document review surface needs for one deal."""
    if await db.get(Deal, deal_id) is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    runs = list(
        (await db.execute(
            select(DealExtractionRun)
            .where(DealExtractionRun.deal_id == deal_id)
            .order_by(DealExtractionRun.created_at.desc())
            .limit(25)
        )).scalars().all()
    )
    cands = list(
        (await db.execute(
            select(DealExtractionCandidate)
            .where(DealExtractionCandidate.deal_id == deal_id)
            .order_by(DealExtractionCandidate.created_at.desc())
        )).scalars().all()
    )
    names = await _doc_names(db, {c.document_id for c in cands})
    return {
        "enabled": settings.document_extraction_enabled,
        "runs": [_run_dict(r) for r in runs],
        "candidates": [_candidate_dict(c, names.get(c.document_id)) for c in cands],
        "pending_review_count": sum(1 for c in cands if c.status in CANDIDATE_NEEDS_REVIEW),
    }


class StartExtractionRequest(BaseModel):
    document_ids: list[int] = Field(min_length=1, max_length=10)


@router.post("/deals/{deal_id}/extractions", status_code=202)
async def start_extraction(
    deal_id: uuid.UUID,
    body: StartExtractionRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    """Opt-in manual run over explicit documents (also the backfill path for old files)."""
    if not settings.document_extraction_enabled:
        raise HTTPException(
            status_code=409,
            detail="Document extraction is disabled (needs ATTACHMENT_INGESTION_ENABLED and DOCUMENT_EXTRACTION_ENABLED).",
        )
    if await db.get(Deal, deal_id) is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    found = set(
        (await db.execute(
            select(DealDocument.id).where(
                DealDocument.id.in_(body.document_ids),
                DealDocument.deal_id == deal_id,
                DealDocument.status == "active",
            )
        )).scalars().all()
    )
    missing = sorted(set(body.document_ids) - found)
    if missing:
        raise HTTPException(status_code=404, detail=f"Documents not on this deal: {missing}")

    from app.services.deal_extraction import enqueue_extraction_run, process_run_background

    run = await enqueue_extraction_run(
        db, deal_id=deal_id, suggestion_id=None, document_ids=sorted(found),
        trigger="manual", requested_by=get_actor_name(auth),
    )
    await db.commit()
    asyncio.create_task(process_run_background(run.id))
    return _run_dict(run)


class AcceptRequest(BaseModel):
    overwrite: bool = False
    note: str | None = None


class RejectRequest(BaseModel):
    note: str | None = None


async def _open_candidate(db: AsyncSession, candidate_id: uuid.UUID) -> DealExtractionCandidate:
    cand = await db.get(DealExtractionCandidate, candidate_id, with_for_update=True)
    if cand is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if cand.status not in CANDIDATE_NEEDS_REVIEW:
        raise HTTPException(status_code=409, detail=f"Candidate already resolved ({cand.status})")
    return cand


@router.post("/extraction-candidates/{candidate_id}/accept")
async def accept_candidate(
    candidate_id: uuid.UUID,
    body: AcceptRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    from app.services.deal_extraction import refresh_document_review_state

    reviewer = get_actor_name(auth)
    cand = await _open_candidate(db, candidate_id)
    deal = await db.get(Deal, cand.deal_id)
    if deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")

    if cand.field in UNDERWRITING_FIELDS and is_underwriting_locked(deal.pipeline_stage):
        raise HTTPException(status_code=409, detail="Underwriting fields are locked")

    validated = validate_field_update(
        cand.field, cand.raw_value,
        FieldContext(current_value=None, current_stage=deal.pipeline_stage, current_status=deal.status),
    )
    if not validated.ok:
        raise HTTPException(status_code=400, detail=f"Value no longer valid: {validated.reason}")

    current = getattr(deal, cand.field, None)
    populated = current is not None and str(current).strip() != ""
    if populated and not body.overwrite:
        raise HTTPException(
            status_code=409,
            detail="Field already has a value; resubmit with overwrite=true to replace it.",
        )

    setattr(deal, cand.field, validated.value)
    deal.updated_by = reviewer
    deal.last_updated = datetime.now(timezone.utc).date()
    db.add(DealUpdateLog(
        deal_id=deal.id, field_changed=cand.field,
        old_value=None if current is None else str(current)[:500],
        new_value=str(validated.value)[:500],
        source="document_extraction_review", email_subject=None,
    ))
    await log_activity(
        db, deal.id, reviewer, "document",
        f"Accepted extracted {cand.field} = {validated.display}",
    )

    now = datetime.now(timezone.utc)
    cand.status, cand.reviewed_by, cand.reviewed_at, cand.review_note = (
        "accepted", reviewer, now, body.note,
    )
    siblings = list(
        (await db.execute(
            select(DealExtractionCandidate).where(
                DealExtractionCandidate.deal_id == cand.deal_id,
                DealExtractionCandidate.field == cand.field,
                DealExtractionCandidate.id != cand.id,
                DealExtractionCandidate.status.in_(tuple(CANDIDATE_NEEDS_REVIEW)),
            )
        )).scalars().all()
    )
    touched = {cand.document_id}
    for sib in siblings:
        same = (sib.display_value or sib.raw_value) == (cand.display_value or cand.raw_value)
        sib.status = "corroborating" if same else "superseded"
        sib.reason = f"resolved by reviewer ({reviewer})"
        touched.add(sib.document_id)
    await db.flush()
    await refresh_document_review_state(db, touched)
    return _candidate_dict(cand, (await _doc_names(db, {cand.document_id})).get(cand.document_id))


@router.post("/extraction-candidates/{candidate_id}/reject")
async def reject_candidate(
    candidate_id: uuid.UUID,
    body: RejectRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    from app.services.deal_extraction import refresh_document_review_state

    reviewer = get_actor_name(auth)
    cand = await _open_candidate(db, candidate_id)
    cand.status, cand.reviewed_by, cand.reviewed_at, cand.review_note = (
        "rejected", reviewer, datetime.now(timezone.utc), body.note,
    )
    await db.flush()
    await refresh_document_review_state(db, {cand.document_id})
    return _candidate_dict(cand, (await _doc_names(db, {cand.document_id})).get(cand.document_id))
