"""
The Inbox — actionable surface over pending_suggestions + email_scan_log.

Preserves /api/inbox and /api/review-queue contracts (integer suggestion ids,
legacy stage field) while returning RE-style groups-by-email and provenance.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_actor_name, require_auth
from app.core.config import settings
from app.db.activity import log_activity
from app.db.approvals import log_approval
from app.db.companies import find_or_create_company_for_deal, sync_company_from_deal
from app.db.documents import file_documents_for_suggestion
from app.db.models import Deal, DealNote, DealUpdateLog, EmailScanLog, PendingSuggestion
from app.db.models.documents import DealDocument
from app.db.portfolio import ensure_portfolio_position
from app.db.session import get_db
from app.domain.field_updates import (
    ALLOWED_FIELD_UPDATES,
    FieldContext,
    coerce_field,
    validate_field_update,
)
from app.domain.pipeline_stage import (
    TERMINAL_STATUSES,
    UNDERWRITING_FIELDS,
    is_underwriting_locked,
    validate_stage_transition,
)

_COMPANY_MIRROR_FIELDS = {"company_name", "location", "state", "sector_primary", "subsector"}

MAX_EMAIL_BODY_CHARS = 30_000

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _suggestion_to_dict(s: PendingSuggestion, deal: Deal | None) -> dict:
    if s.suggested_field == "new_deal" or s.kind == "new_deal":
        try:
            nd = json.loads(s.suggested_value or "{}")
        except (json.JSONDecodeError, TypeError):
            nd = s.payload or {}
        company_name = nd.get("company_name", "Unknown")
        pipeline_stage = None
        stage = None
    else:
        company_name = deal.company_name if deal else "Unknown"
        pipeline_stage = deal.pipeline_stage if deal else None
        stage = deal.stage if deal else None
    return {
        "id": s.id,
        "deal_id": str(s.deal_id) if s.deal_id else None,
        "company_name": company_name,
        "stage": stage,
        "pipeline_stage": pipeline_stage,
        "kind": s.kind,
        "suggested_field": s.suggested_field,
        "suggested_value": s.suggested_value,
        "evidence": s.evidence,
        "requires_attention": s.requires_attention,
        "claude_summary": s.claude_summary,
        "email_subject": s.email_subject,
        "email_snippet": s.email_snippet,
        "current_value": s.current_value,
        "confidence": s.confidence,
        "estimated_size_m": float(s.estimated_size_m) if s.estimated_size_m is not None else None,
        "estimated_sector": s.estimated_sector,
        "payload": s.payload,
        "created_at": s.created_at.isoformat(),
    }


def _attachment_state(log: EmailScanLog) -> str:
    """What happened to this email's attachments, for the review UI.

    none      the message has no attachments
    disabled  it has attachments but ingestion is off and nothing was stored
    pending   ingestion is on and has not processed this message yet
    failed    at least one attachment could not be fetched/stored (retried by the scanner)
    ingested  every attachment has a recorded outcome (stored / duplicate / skipped)
    """
    if not log.has_attachments:
        return "none"
    summary = log.attachment_summary or []
    dispositions = {e.get("disposition") for e in summary if isinstance(e, dict)}
    if "failed" in dispositions:
        return "failed"
    if dispositions - {None}:
        return "ingested"
    return "disabled" if not settings.ATTACHMENT_INGESTION_ENABLED else "pending"


def _inbox_document(d: DealDocument) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "doc_type": d.doc_type,
        "content_type": d.content_type,
        "size_bytes": d.size_bytes,
        "sha256": d.sha256,
        "deal_id": str(d.deal_id) if d.deal_id else None,
        "filed": d.deal_id is not None,
        "processing_status": d.processing_status,
        "human_review_required": d.human_review_required,
        "skip_reason": d.skip_reason,
    }


def _group_sort_key(group: dict) -> datetime:
    received = group.get("_sort_at")
    if isinstance(received, datetime):
        return received
    return datetime.min.replace(tzinfo=timezone.utc)


def _build_inbox_group(
    *,
    key: str,
    suggestion: PendingSuggestion,
    deal: Deal | None,
    log: EmailScanLog | None,
) -> dict:
    if log is not None:
        deal_id = (
            str(log.matched_deal_id)
            if log.matched_deal_id
            else (str(suggestion.deal_id) if suggestion.deal_id else None)
        )
        deal_name = deal.company_name if deal else None
        if suggestion.suggested_field == "new_deal" or suggestion.kind == "new_deal":
            try:
                nd = json.loads(suggestion.suggested_value or "{}")
            except (json.JSONDecodeError, TypeError):
                nd = suggestion.payload or {}
            deal_name = deal_name or nd.get("company_name")
        return {
            "id": key,
            "mailbox": log.user_email or log.folder,
            "email_subject": log.subject or suggestion.email_subject,
            "email_from": log.sender_address,
            "email_from_name": log.sender_name,
            "email_snippet": log.body_snippet or suggestion.email_snippet,
            "received_at": log.received_at.isoformat() if log.received_at else None,
            "has_attachments": bool(log.has_attachments),
            "attachment_count": int(log.attachment_count or 0),
            "attachment_summary": log.attachment_summary,
            "attachment_state": _attachment_state(log),
            "source_removed": log.source_removed_at is not None,
            "scan_action": log.action_taken,
            "documents": [],
            "deal_id": deal_id,
            "deal_name": deal_name,
            "suggestions": [],
            "_sort_at": log.received_at or suggestion.created_at,
        }

    company_name = None
    if suggestion.suggested_field == "new_deal" or suggestion.kind == "new_deal":
        try:
            nd = json.loads(suggestion.suggested_value or "{}")
        except (json.JSONDecodeError, TypeError):
            nd = suggestion.payload or {}
        company_name = nd.get("company_name")
    elif deal is not None:
        company_name = deal.company_name

    return {
        "id": key,
        "mailbox": None,
        "email_subject": suggestion.email_subject,
        "email_from": None,
        "email_from_name": None,
        "email_snippet": suggestion.email_snippet,
        "received_at": None,
        "has_attachments": False,
        "attachment_count": 0,
        "attachment_summary": None,
        "attachment_state": "none",
        "source_removed": False,
        "scan_action": None,
        "documents": [],
        "deal_id": str(suggestion.deal_id) if suggestion.deal_id else None,
        "deal_name": company_name,
        "suggestions": [],
        "_sort_at": suggestion.created_at,
    }


@router.get("/inbox")
@router.get("/review-queue")
async def list_inbox(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PendingSuggestion, Deal, EmailScanLog)
        .outerjoin(Deal, PendingSuggestion.deal_id == Deal.id)
        .outerjoin(EmailScanLog, PendingSuggestion.email_scan_log_id == EmailScanLog.id)
        .where(PendingSuggestion.status == "pending")
        .order_by(PendingSuggestion.created_at.desc())
    )
    groups: dict[str, dict] = {}
    for suggestion, deal, log in result.all():
        if suggestion.email_scan_log_id is not None:
            key = str(suggestion.email_scan_log_id)
        else:
            key = f"orphan-{suggestion.id}"
        if key not in groups:
            groups[key] = _build_inbox_group(
                key=key, suggestion=suggestion, deal=deal, log=log
            )
        groups[key]["suggestions"].append(_suggestion_to_dict(suggestion, deal))

    log_ids = [int(k) for k in groups if k.isdigit()]
    if log_ids:
        from app.db.models.documents import DealDocumentEmailLog

        linked = (
            await db.execute(
                select(DealDocument, DealDocumentEmailLog.email_scan_log_id)
                .join(DealDocumentEmailLog, DealDocumentEmailLog.document_id == DealDocument.id)
                .where(
                    DealDocumentEmailLog.email_scan_log_id.in_(log_ids),
                    DealDocument.status == "active",
                )
                .order_by(DealDocument.id)
            )
        ).all()
        seen: set[tuple[str, int]] = set()
        for doc, log_id in linked:
            key = str(log_id)
            if (key, doc.id) not in seen:
                seen.add((key, doc.id))
                groups[key]["documents"].append(_inbox_document(doc))

    ordered = sorted(groups.values(), key=_group_sort_key, reverse=True)
    for group in ordered:
        group.pop("_sort_at", None)
    return ordered


async def _maybe_start_extraction(
    db: AsyncSession,
    *,
    deal_id: uuid.UUID,
    suggestion_id: int | None,
    document_ids: list[int] | None = None,
    trigger: str = "approval",
) -> str | None:
    if not settings.document_extraction_enabled:
        return None
    from app.services.deal_extraction import enqueue_extraction_run, process_run_background

    run = await enqueue_extraction_run(
        db, deal_id=deal_id, suggestion_id=suggestion_id,
        document_ids=document_ids, trigger=trigger,
    )
    if run is None:
        return None
    # Commit first: the background worker opens its own session and must see the
    # run (and the approval that triggered it).
    await db.commit()
    asyncio.create_task(process_run_background(run.id))
    return str(run.id)


async def _get_pending_or_404(suggestion_id: int, db: AsyncSession) -> PendingSuggestion:
    result = await db.execute(
        select(PendingSuggestion).where(
            PendingSuggestion.id == suggestion_id,
            PendingSuggestion.status == "pending",
        )
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found or already reviewed")
    return suggestion


class NewDealForm(BaseModel):
    """Reviewer-edited fields for a deal created from an email."""

    company_name: str
    sector: str | None = None
    deal_size_m: str | None = None
    summary: str | None = None


class ApproveRequest(BaseModel):
    value: str | None = None
    deal_id: uuid.UUID | None = None
    allow_stage_skip: bool = False
    reasoning: str | None = None
    new_deal: NewDealForm | None = None


async def _apply_field_update(
    db: AsyncSession,
    suggestion: PendingSuggestion,
    deal: Deal,
    raw: str | None,
    *,
    allow_stage_skip: bool,
    reasoning: str | None,
    reviewer: str,
) -> None:
    """Validate and write one proposed field onto ``deal``.

    Raises HTTPException (400 invalid, 409 locked) without having changed
    anything, so callers can collect failures per field.
    """
    field = suggestion.suggested_field

    if field == "commentary":
        existing = deal.commentary or ""
        final_value = f"{existing}\n{raw}".strip() if existing else (raw or "")
    elif field == "sponsor_id":
        final_value = int(raw) if raw not in (None, "") else None
    elif field == "pipeline_stage":
        err = validate_stage_transition(
            deal.pipeline_stage, (raw or "").strip(), allow_skip=allow_stage_skip
        )
        if err:
            raise HTTPException(status_code=400, detail=err)
        if allow_stage_skip and not (reasoning or "").strip():
            raise HTTPException(
                status_code=400, detail="reasoning required when allow_stage_skip is set"
            )
        final_value = (raw or "").strip()
    elif field == "status":
        final_value = (raw or "").strip()
        if final_value in TERMINAL_STATUSES and not (
            reasoning or suggestion.email_subject or suggestion.claude_summary
        ):
            raise HTTPException(
                status_code=400, detail="reasoning required for terminal status"
            )
    elif field in UNDERWRITING_FIELDS and is_underwriting_locked(deal.pipeline_stage):
        raise HTTPException(status_code=409, detail="Underwriting fields are locked")
    else:
        try:
            final_value = coerce_field(field, raw or "")
        except ValueError as exc:
            if field in ALLOWED_FIELD_UPDATES:
                # An allowlisted field with an unparseable value would otherwise be
                # written raw into a typed column.
                raise HTTPException(
                    status_code=400, detail=f"Invalid value for {field}: {exc}"
                ) from exc
            # Fields outside the email allowlist (legacy) keep raw string.
            final_value = raw

    if suggestion.deal_id != deal.id:
        suggestion.deal_id = deal.id
    old_value = str(getattr(deal, field) or "")
    new_value = str(final_value) if final_value is not None else ""
    setattr(deal, field, final_value)
    deal.last_updated = datetime.now(timezone.utc).date()
    deal.updated_by = "email_scan"

    if field == "pipeline_stage" and final_value == "portfolio_monitoring":
        await ensure_portfolio_position(deal, db)

    if new_value != old_value:
        db.add(DealUpdateLog(
            deal_id=deal.id,
            field_changed=field,
            old_value=old_value[:500] if old_value else None,
            new_value=new_value[:500] if new_value else None,
            source="email_scan",
            email_subject=suggestion.email_subject,
        ))
        activity_type = "stage_change" if field == "pipeline_stage" else "email"
        await log_activity(
            db, deal.id, "Email Scanner", activity_type,
            f"{field} updated from email: {suggestion.email_subject or ''}".strip(),
        )
        if field in ("pipeline_stage", "status"):
            context = reasoning or suggestion.email_subject or suggestion.claude_summary
            auto_reasoning = f"Approved via inbox — {context}" if context else "Approved via inbox"
            await log_approval(db, deal.id, str(final_value), reviewer, reasoning=auto_reasoning)
        if field in _COMPANY_MIRROR_FIELDS:
            await sync_company_from_deal(db, deal)

    suggestion.status = "approved"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by = reviewer


@router.post("/inbox/{suggestion_id}/approve")
@router.post("/review-queue/{suggestion_id}/approve")
async def approve_suggestion(
    suggestion_id: int,
    body: ApproveRequest = ApproveRequest(),
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    reviewer = get_actor_name(auth)
    suggestion = await _get_pending_or_404(suggestion_id, db)

    if suggestion.suggested_field == "new_deal" or suggestion.kind == "new_deal":
        return await _approve_new_deal(suggestion, body, db, reviewer)

    target_deal_id = body.deal_id if body.deal_id is not None else suggestion.deal_id
    deal_res = await db.execute(select(Deal).where(Deal.id == target_deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    raw = body.value if body.value is not None else suggestion.suggested_value
    await _apply_field_update(
        db, suggestion, deal, raw,
        allow_stage_skip=body.allow_stage_skip, reasoning=body.reasoning, reviewer=reviewer,
    )
    await file_documents_for_suggestion(db, suggestion, deal.id)

    response = {"ok": True, "deal_id": str(deal.id), "company_name": deal.company_name}
    extraction_run_id = await _maybe_start_extraction(
        db, deal_id=deal.id, suggestion_id=suggestion.id
    )
    if extraction_run_id is not None:
        response["extraction_run_id"] = extraction_run_id
    return response


async def _approve_new_deal(
    suggestion: PendingSuggestion,
    body: ApproveRequest,
    db: AsyncSession,
    reviewer: str,
):
    if body.deal_id is not None:
        # Link to existing deal (same as assign).
        deal_res = await db.execute(select(Deal).where(Deal.id == body.deal_id))
        deal = deal_res.scalar_one_or_none()
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")
        suggestion.deal_id = body.deal_id
        suggestion.status = "approved"
        suggestion.reviewed_at = datetime.now(timezone.utc)
        suggestion.reviewed_by = reviewer
        await file_documents_for_suggestion(db, suggestion, deal.id)
        await log_activity(
            db, deal.id, "Email Scanner", "email",
            f"Inbox item linked — {suggestion.email_subject or ''}".strip(),
        )
        response = {
            "ok": True,
            "deal_id": str(deal.id),
            "company_name": deal.company_name,
            "linked": True,
        }
        extraction_run_id = await _maybe_start_extraction(
            db, deal_id=deal.id, suggestion_id=suggestion.id
        )
        if extraction_run_id is not None:
            response["extraction_run_id"] = extraction_run_id
        return response

    new_deal = await _create_deal_from_suggestion(db, suggestion, body.new_deal)
    suggestion.deal_id = new_deal.id
    suggestion.status = "approved"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by = reviewer
    await file_documents_for_suggestion(db, suggestion, new_deal.id)
    await log_activity(
        db, new_deal.id, "Email Scanner", "system",
        f"Deal accepted from inbox — {suggestion.email_subject or ''}".strip(),
    )

    response = {
        "ok": True,
        "deal_id": str(new_deal.id),
        "company_name": new_deal.company_name,
        "created": True,
    }
    extraction_run_id = await _maybe_start_extraction(
        db, deal_id=new_deal.id, suggestion_id=suggestion.id
    )
    if extraction_run_id is not None:
        response["extraction_run_id"] = extraction_run_id
    return response


async def _create_deal_from_suggestion(
    db: AsyncSession, suggestion: PendingSuggestion, form: NewDealForm | None
) -> Deal:
    """Create the deal for a new_deal suggestion; ``form`` carries reviewer edits."""
    try:
        nd = json.loads(suggestion.suggested_value or "{}")
    except (json.JSONDecodeError, TypeError):
        nd = suggestion.payload or {}
    company_name = (form.company_name if form else nd.get("company_name", "Unknown")).strip()
    if not company_name:
        raise HTTPException(status_code=400, detail="Company name is required")
    sector = (form.sector if form else nd.get("sector")) or None
    summary = form.summary if form else nd.get("summary", "")
    deal_size = None
    if form and (form.deal_size_m or "").strip():
        checked = validate_field_update("deal_size_m", form.deal_size_m, FieldContext())
        if not checked.ok:
            raise HTTPException(
                status_code=400, detail=f"Invalid value for deal_size_m: {checked.reason}"
            )
        deal_size = checked.value

    ts = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    company = await find_or_create_company_for_deal(db, company_name, sector=sector)
    deal = Deal(
        company_id=company.company_id,
        company_name=company_name,
        sector_primary=sector,
        deal_size_m=deal_size,
        bucket="Active-Discussions",
        stage="Initial Conversations",
        pipeline_stage="intake_triage",
        status="Active",
        commentary=f"{ts}: [Auto] {summary or ''}",
        updated_by="email_scan",
    )
    db.add(deal)
    await db.flush()
    return deal


class AssignRequest(BaseModel):
    deal_id: uuid.UUID


@router.post("/inbox/{suggestion_id}/assign")
async def assign_suggestion(
    suggestion_id: int,
    body: AssignRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    reviewer = get_actor_name(auth)
    suggestion = await _get_pending_or_404(suggestion_id, db)
    if suggestion.suggested_field != "new_deal" and suggestion.kind != "new_deal":
        raise HTTPException(
            status_code=400,
            detail="Only new_deal suggestions can be assigned to an existing deal",
        )

    deal_res = await db.execute(select(Deal).where(Deal.id == body.deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Target deal not found")

    suggestion.deal_id = body.deal_id
    suggestion.status = "approved"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by = reviewer

    await file_documents_for_suggestion(db, suggestion, body.deal_id)

    note_body = (
        f"Inbox linked: {suggestion.email_subject or suggestion.claude_summary or 'auto-detected signal'}"
    )
    db.add(DealNote(deal_id=body.deal_id, author="Email Scanner", body=note_body))
    await log_activity(
        db, body.deal_id, "Email Scanner", "email",
        f"Inbox item linked — {suggestion.email_subject or ''}".strip(),
    )
    response = {"ok": True, "deal_id": str(body.deal_id), "company_name": deal.company_name}
    extraction_run_id = await _maybe_start_extraction(
        db, deal_id=body.deal_id, suggestion_id=suggestion.id
    )
    if extraction_run_id is not None:
        response["extraction_run_id"] = extraction_run_id
    return response


@router.post("/inbox/{suggestion_id}/reject")
@router.post("/review-queue/{suggestion_id}/reject")
async def reject_suggestion(
    suggestion_id: int,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    suggestion = await _get_pending_or_404(suggestion_id, db)
    suggestion.status = "rejected"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by = get_actor_name(auth)
    return {"ok": True, "suggestion_id": suggestion_id}


# --- One reviewed decision per email -------------------------------------------------


class GroupFieldDecision(BaseModel):
    suggestion_id: int
    value: str | None = None
    include: bool = True


class GroupAcceptRequest(BaseModel):
    """The reviewer's whole decision for one email: edited values, applied together."""

    deal_id: uuid.UUID | None = None
    new_deal: NewDealForm | None = None
    fields: list[GroupFieldDecision] = []
    allow_stage_skip: bool = False
    reasoning: str | None = None


async def _pending_for_group(db: AsyncSession, group_key: str) -> list[PendingSuggestion]:
    if group_key.startswith("orphan-") and group_key[7:].isdigit():
        clause = PendingSuggestion.id == int(group_key[7:])
    elif group_key.isdigit():
        clause = PendingSuggestion.email_scan_log_id == int(group_key)
    else:
        raise HTTPException(status_code=404, detail="Inbox item not found")
    rows = (
        await db.execute(
            select(PendingSuggestion)
            .where(clause, PendingSuggestion.status == "pending")
            .order_by(PendingSuggestion.id)
        )
    ).scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="Inbox item not found or already reviewed")
    return list(rows)


def _is_new_deal(s: PendingSuggestion) -> bool:
    return s.suggested_field == "new_deal" or s.kind == "new_deal"


@router.post("/inbox/groups/{group_key}/accept")
async def accept_group(
    group_key: str,
    body: GroupAcceptRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    """Apply every included field for one email in a single transaction.

    Fields the reviewer unticks are rejected; fields the request does not mention
    stay pending (they may have arrived after the form loaded). If any field fails
    validation nothing is written and the response lists each failure by id.
    """
    reviewer = get_actor_name(auth)
    pending = await _pending_for_group(db, group_key)
    new_deals = [s for s in pending if _is_new_deal(s)]
    updates = [s for s in pending if not _is_new_deal(s)]
    decisions = {d.suggestion_id: d for d in body.fields}
    unknown = set(decisions) - {s.id for s in updates}
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown suggestion ids: {sorted(unknown)}")

    response: dict = {"ok": True, "applied": [], "rejected": [], "linked": False, "created": False}
    deal: Deal | None = None
    anchor = pending[0]

    if new_deals:
        anchor = new_deals[0]
        if body.deal_id is not None:
            deal = (
                await db.execute(select(Deal).where(Deal.id == body.deal_id))
            ).scalar_one_or_none()
            if deal is None:
                raise HTTPException(status_code=404, detail="Deal not found")
            response["linked"] = True
            await log_activity(
                db, deal.id, "Email Scanner", "email",
                f"Inbox item linked — {anchor.email_subject or ''}".strip(),
            )
        else:
            deal = await _create_deal_from_suggestion(db, anchor, body.new_deal)
            response["created"] = True
            await log_activity(
                db, deal.id, "Email Scanner", "system",
                f"Deal accepted from inbox — {anchor.email_subject or ''}".strip(),
            )
        now = datetime.now(timezone.utc)
        for s in new_deals:
            s.deal_id = deal.id
            s.status = "approved"
            s.reviewed_at, s.reviewed_by = now, reviewer
            response["applied"].append(s.id)

    errors: list[dict] = []
    for s in updates:
        decision = decisions.get(s.id)
        if decision is None:
            continue
        if not decision.include:
            s.status = "rejected"
            s.reviewed_at = datetime.now(timezone.utc)
            s.reviewed_by = reviewer
            response["rejected"].append(s.id)
            continue
        target = deal
        if target is None:
            target_id = body.deal_id or s.deal_id
            target = (
                await db.execute(select(Deal).where(Deal.id == target_id))
            ).scalar_one_or_none() if target_id else None
        if target is None:
            errors.append({
                "suggestion_id": s.id, "field": s.suggested_field,
                "status": 404, "message": "Pick a deal for this update",
            })
            continue
        raw = decision.value if decision.value is not None else s.suggested_value
        try:
            async with db.begin_nested():
                await _apply_field_update(
                    db, s, target, raw,
                    allow_stage_skip=body.allow_stage_skip,
                    reasoning=body.reasoning,
                    reviewer=reviewer,
                )
        except HTTPException as exc:
            errors.append({
                "suggestion_id": s.id, "field": s.suggested_field,
                "status": exc.status_code, "message": str(exc.detail),
            })
            continue
        deal = deal or target
        response["applied"].append(s.id)

    if errors:
        # Raising rolls the whole session back (get_db), including a deal created above.
        raise HTTPException(
            status_code=422,
            detail={"message": "Some values could not be applied", "errors": errors},
        )
    if deal is None:
        # Nothing applied (everything unticked): the email was still reviewed.
        response["deal_id"] = None
        response["company_name"] = None
    else:
        await file_documents_for_suggestion(db, anchor, deal.id)
        response["deal_id"] = str(deal.id)
        response["company_name"] = deal.company_name
        run_id = await _maybe_start_extraction(db, deal_id=deal.id, suggestion_id=anchor.id)
        if run_id is not None:
            response["extraction_run_id"] = run_id
    response["remaining"] = len(updates) - len(decisions)
    return response


@router.post("/inbox/groups/{group_key}/dismiss")
async def dismiss_group(
    group_key: str,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    reviewer = get_actor_name(auth)
    pending = await _pending_for_group(db, group_key)
    now = datetime.now(timezone.utc)
    for s in pending:
        s.status = "rejected"
        s.reviewed_at, s.reviewed_by = now, reviewer
    return {"ok": True, "rejected": [s.id for s in pending]}



@router.get("/inbox/groups/{group_key}/email")
async def read_group_email(group_key: str, db: AsyncSession = Depends(get_db)):
    """The full message body, fetched live from Graph for display only.

    The scanner stores just a short preview; the body is never persisted. When it
    cannot be read (not configured, deleted, Graph error) the response says why
    instead of failing, so the review page still works.
    """
    if not group_key.isdigit():
        return {"available": False, "reason": "no_source_email", "body": None}
    log = (
        await db.execute(select(EmailScanLog).where(EmailScanLog.id == int(group_key)))
    ).scalar_one_or_none()
    if log is None or not log.user_email or not log.graph_message_id:
        return {"available": False, "reason": "no_source_email", "body": None}
    if not (settings.AZURE_CLIENT_ID and settings.AZURE_CLIENT_SECRET):
        return {"available": False, "reason": "graph_not_configured", "body": None}

    import httpx

    from app.domain.email_text import collapse_whitespace, html_to_text, strip_mail_noise
    from app.graph.http import GraphError
    from app.graph.mail import fetch_message

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            message = await fetch_message(
                client, user_email=log.user_email, message_id=log.graph_message_id
            )
    except (GraphError, httpx.HTTPError):
        return {"available": False, "reason": "graph_error", "body": None}
    if message is None:
        return {"available": False, "reason": "removed", "body": None}

    block = message.get("body") or {}
    content = block.get("content") or message.get("bodyPreview") or ""
    if (block.get("contentType") or "").lower() == "html":
        content = html_to_text(content)
    text = collapse_whitespace(strip_mail_noise(content))
    truncated = len(text) > MAX_EMAIL_BODY_CHARS
    return {
        "available": True,
        "reason": None,
        "body": text[:MAX_EMAIL_BODY_CHARS],
        "truncated": truncated,
    }


@router.get("/inbox/unfiled-documents")
async def list_unfiled_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DealDocument, EmailScanLog)
        .outerjoin(EmailScanLog, DealDocument.email_scan_log_id == EmailScanLog.id)
        .where(DealDocument.deal_id.is_(None), DealDocument.status == "active")
        .order_by(DealDocument.created_at.desc())
    )
    return [
        {
            "id": d.id,
            "name": d.name,
            "doc_type": d.doc_type,
            "size_bytes": d.size_bytes,
            "sha256": d.sha256,
            "source": d.source,
            "email_scan_log_id": d.email_scan_log_id,
            "processing_status": d.processing_status,
            "email_subject": log.subject if log else None,
            "email_from": log.sender_address if log else None,
            "email_received_at": log.received_at.isoformat() if log and log.received_at else None,
            "created_at": d.created_at.isoformat(),
        }
        for d, log in result.all()
    ]


class FileDocumentRequest(BaseModel):
    deal_id: uuid.UUID


@router.post("/inbox/unfiled-documents/{document_id}/file")
async def file_unfiled_document(
    document_id: int,
    body: FileDocumentRequest,
    db: AsyncSession = Depends(get_db),
):
    doc = (
        await db.execute(
            select(DealDocument).where(
                DealDocument.id == document_id,
                DealDocument.status == "active",
                DealDocument.deal_id.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Unfiled document not found")
    deal = (
        await db.execute(select(Deal).where(Deal.id == body.deal_id))
    ).scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if doc.sha256:
        from app.db.documents import find_duplicate
        dup = await find_duplicate(db, sha256=doc.sha256, deal_id=body.deal_id)
        if dup is not None:
            doc.status = "deleted"
            return {"ok": True, "duplicate_of": dup.id, "filed": False}
    doc.deal_id = body.deal_id
    response = {"ok": True, "deal_id": str(body.deal_id), "filed": True}
    await db.flush()
    run_id = await _maybe_start_extraction(
        db, deal_id=body.deal_id, suggestion_id=None, document_ids=[doc.id], trigger="assignment"
    )
    if run_id is not None:
        response["extraction_run_id"] = run_id
    return response


@router.post("/admin/scan")
async def trigger_scan(db: AsyncSession = Depends(get_db)):
    from app.automation.scanner import run_scan
    outcome = await run_scan(db, trigger="manual")
    return {
        "ok": True,
        "emails_processed": outcome.messages_classified,
        "status": outcome.status,
        "run_id": str(outcome.run_id) if outcome.run_id else None,
        "messages_seen": outcome.messages_seen,
        "suggestions_created": outcome.suggestions_created,
        "estimated_cost_usd": float(outcome.estimated_cost_usd),
    }
