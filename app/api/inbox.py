"""
The Inbox — the actionable surface over the email scanner's output
(pending_suggestions + email_scan_log). Renamed from the old /review-queue
routes, with a new `assign` action added for linking a detected new-deal
signal to an existing deal instead of always creating one.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.activity import log_activity
from app.db.models import Deal, DealNote, DealUpdateLog, PendingSuggestion
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _suggestion_to_dict(s: PendingSuggestion, deal: Deal | None) -> dict:
    if s.suggested_field == "new_deal":
        try:
            nd = json.loads(s.suggested_value or "{}")
        except (json.JSONDecodeError, TypeError):
            nd = {}
        company_name = nd.get("company_name", "Unknown")
        pipeline_stage = None
    else:
        company_name = deal.company_name if deal else "Unknown"
        pipeline_stage = deal.pipeline_stage if deal else None
    return {
        "id": s.id,
        "deal_id": s.deal_id,
        "company_name": company_name,
        "pipeline_stage": pipeline_stage,
        "suggested_field": s.suggested_field,
        "suggested_value": s.suggested_value,
        "claude_summary": s.claude_summary,
        "email_subject": s.email_subject,
        "email_snippet": s.email_snippet,
        "current_value": s.current_value,
        "confidence": s.confidence,
        "estimated_size_m": float(s.estimated_size_m) if s.estimated_size_m is not None else None,
        "estimated_sector": s.estimated_sector,
        "created_at": s.created_at.isoformat(),
    }


@router.get("/inbox")
async def list_inbox(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PendingSuggestion, Deal)
        .outerjoin(Deal, PendingSuggestion.deal_id == Deal.id)
        .where(PendingSuggestion.status == "pending")
        .order_by(PendingSuggestion.created_at.desc())
    )
    return [_suggestion_to_dict(s, d) for s, d in result.all()]


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


class ApproveRequest(BaseModel):
    reviewer: str = "user"
    value: str | None = None  # optional edited value; falls back to suggestion.suggested_value


@router.post("/inbox/{suggestion_id}/approve")
async def approve_suggestion(
    suggestion_id: int,
    body: ApproveRequest = ApproveRequest(),
    db: AsyncSession = Depends(get_db),
):
    suggestion = await _get_pending_or_404(suggestion_id, db)

    # New deal creation
    if suggestion.suggested_field == "new_deal":
        try:
            nd = json.loads(suggestion.suggested_value or "{}")
        except (json.JSONDecodeError, TypeError):
            nd = {}
        ts = datetime.now(timezone.utc).strftime("%Y/%m/%d")
        new_deal = Deal(
            company_name=nd.get("company_name", "Unknown"),
            sector_primary=nd.get("sector"),
            bucket="Active-Discussions",
            stage="Initial Conversations",
            pipeline_stage="intake_triage",
            status="Active",
            commentary=f"{ts}: [Auto] {nd.get('summary', '')}",
            updated_by="email_scan",
        )
        db.add(new_deal)
        await db.flush()
        suggestion.status = "approved"
        suggestion.reviewed_at = datetime.now(timezone.utc)
        suggestion.reviewed_by = body.reviewer
        await log_activity(db, new_deal.id, "Email Scanner", "system", f"Deal accepted from inbox — {suggestion.email_subject or ''}".strip())
        return {"ok": True, "deal_id": new_deal.id, "company_name": new_deal.company_name, "created": True}

    deal_res = await db.execute(select(Deal).where(Deal.id == suggestion.deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    new_line = body.value if body.value is not None else suggestion.suggested_value

    if suggestion.suggested_field == "commentary":
        existing = deal.commentary or ""
        final_value = f"{existing}\n{new_line}".strip() if existing else (new_line or "")
    elif suggestion.suggested_field == "sponsor_id":
        final_value = int(new_line) if new_line not in (None, "") else None
    else:
        final_value = new_line

    old_value = str(getattr(deal, suggestion.suggested_field) or "")
    setattr(deal, suggestion.suggested_field, final_value)
    deal.last_updated = datetime.now(timezone.utc).date()
    deal.updated_by = "email_scan"

    db.add(DealUpdateLog(
        deal_id=deal.id,
        field_changed=suggestion.suggested_field,
        old_value=old_value[:500] if old_value else None,
        new_value=(final_value or "")[:500],
        source="email_scan",
        email_subject=suggestion.email_subject,
    ))

    activity_type = "stage_change" if suggestion.suggested_field == "pipeline_stage" else "email"
    await log_activity(
        db, deal.id, "Email Scanner", activity_type,
        f"{suggestion.suggested_field} updated from email: {suggestion.email_subject or ''}".strip(),
    )

    suggestion.status = "approved"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by = body.reviewer

    return {"ok": True, "deal_id": deal.id, "company_name": deal.company_name}


class AssignRequest(BaseModel):
    deal_id: int
    reviewer: str = "user"


@router.post("/inbox/{suggestion_id}/assign")
async def assign_suggestion(suggestion_id: int, body: AssignRequest, db: AsyncSession = Depends(get_db)):
    """Link a detected new-deal signal to an EXISTING deal instead of creating one."""
    suggestion = await _get_pending_or_404(suggestion_id, db)
    if suggestion.suggested_field != "new_deal":
        raise HTTPException(status_code=400, detail="Only new_deal suggestions can be assigned to an existing deal")

    deal_res = await db.execute(select(Deal).where(Deal.id == body.deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Target deal not found")

    suggestion.deal_id = body.deal_id
    suggestion.status = "approved"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by = body.reviewer

    note_body = f"Inbox linked: {suggestion.email_subject or suggestion.claude_summary or 'auto-detected signal'}"
    db.add(DealNote(deal_id=body.deal_id, author="Email Scanner", body=note_body))
    await log_activity(db, body.deal_id, "Email Scanner", "email", f"Inbox item linked — {suggestion.email_subject or ''}".strip())

    return {"ok": True, "deal_id": body.deal_id, "company_name": deal.company_name}


@router.post("/inbox/{suggestion_id}/reject")
async def reject_suggestion(suggestion_id: int, reviewer: str = "user", db: AsyncSession = Depends(get_db)):
    suggestion = await _get_pending_or_404(suggestion_id, db)
    suggestion.status = "rejected"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by = reviewer
    return {"ok": True, "suggestion_id": suggestion_id}


@router.post("/admin/scan")
async def trigger_scan(db: AsyncSession = Depends(get_db)):
    from app.automation.scanner import run_scan
    count = await run_scan(db)
    return {"ok": True, "emails_processed": count}
