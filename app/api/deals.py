from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, text, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.models import Deal, DealUpdateLog, EmailScanLog, PendingSuggestion
from app.db.session import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

EDITABLE_FIELDS = {
    "company_name", "location", "stage", "sector_primary", "sector_full",
    "subsector", "deal_size_m", "security", "uop", "source", "commentary",
    "reasons_for_passing", "bucket",
}


class PatchRequest(BaseModel):
    field: str
    value: str | None


@router.patch("/deals/{deal_id}")
async def patch_deal(
    deal_id: int,
    body: PatchRequest,
    db: AsyncSession = Depends(get_db),
):
    if body.field not in EDITABLE_FIELDS:
        raise HTTPException(status_code=400, detail=f"Field '{body.field}' is not editable")

    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    old_value = str(getattr(deal, body.field)) if getattr(deal, body.field) is not None else None

    setattr(deal, body.field, body.value)
    deal.updated_by = "manual_edit"
    deal.updated_at = datetime.now(timezone.utc)

    log = DealUpdateLog(
        deal_id=deal_id,
        field_changed=body.field,
        old_value=old_value,
        new_value=body.value,
        source="manual_edit",
    )
    db.add(log)

    return {"ok": True, "deal_id": deal_id, "field": body.field, "value": body.value}


@router.get("/deals")
async def list_deals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal).order_by(Deal.bucket, Deal.company_name))
    deals = result.scalars().all()
    return [
        {
            "id": d.id,
            "company_name": d.company_name,
            "bucket": d.bucket,
            "stage": d.stage,
            "location": d.location,
            "deal_size_m": float(d.deal_size_m) if d.deal_size_m else None,
            "sector_primary": d.sector_primary,
            "sector_full": d.sector_full,
            "subsector": d.subsector,
            "security": d.security,
            "uop": d.uop,
            "source": d.source,
            "nda": d.nda,
            "dataroom": d.dataroom,
            "mgmt_meeting": d.mgmt_meeting,
            "ioi_offered": d.ioi_offered,
            "ioi_signed": d.ioi_signed,
            "target_close": d.target_close.isoformat() if d.target_close else None,
            "commentary": d.commentary,
            "reasons_for_passing": d.reasons_for_passing,
            "last_updated": d.last_updated.isoformat() if d.last_updated else None,
            "updated_by": d.updated_by,
            "total_funded_m": float(d.total_funded_m) if d.total_funded_m else None,
        }
        for d in deals
    ]


@router.get("/kpis")
async def get_kpis(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal))
    all_deals = result.scalars().all()
    closed = [d for d in all_deals if d.bucket == "Closed"]
    return {
        "total_reviewed": len(all_deals),
        "closed": len(closed),
        "active_diligence": sum(1 for d in all_deals if d.bucket == "Active-Diligence"),
        "active_discussions": sum(1 for d in all_deals if d.bucket == "Active-Discussions"),
        "passed": sum(1 for d in all_deals if d.bucket == "Dead-Hold"),
        "deployed_m": float(sum(d.total_funded_m or 0 for d in closed)),
    }


@router.get("/logs/deal-updates")
async def get_deal_update_logs(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    deal_id: Optional[int] = Query(None),
):
    q = (
        select(DealUpdateLog, Deal.company_name)
        .join(Deal, DealUpdateLog.deal_id == Deal.id)
        .order_by(desc(DealUpdateLog.changed_at))
        .limit(limit)
        .offset(offset)
    )
    if deal_id is not None:
        q = q.where(DealUpdateLog.deal_id == deal_id)
    rows = (await db.execute(q)).all()
    return [
        {
            "id": log.id,
            "deal_id": log.deal_id,
            "company_name": name,
            "field_changed": log.field_changed,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "source": log.source,
            "changed_at": log.changed_at.isoformat(),
            "email_subject": log.email_subject,
        }
        for log, name in rows
    ]


@router.get("/logs/email-scans")
async def get_email_scan_logs(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    q = (
        select(EmailScanLog, Deal.company_name)
        .outerjoin(Deal, EmailScanLog.matched_deal_id == Deal.id)
        .order_by(desc(EmailScanLog.processed_at))
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "id": log.id,
            "subject": log.subject,
            "user_email": log.user_email,
            "received_at": log.received_at.isoformat() if log.received_at else None,
            "processed_at": log.processed_at.isoformat(),
            "matched_deal_id": log.matched_deal_id,
            "company_name": name,
            "claude_summary": log.claude_summary,
            "action_taken": log.action_taken,
        }
        for log, name in rows
    ]


@router.get("/review-queue")
async def get_review_queue(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PendingSuggestion, Deal)
        .join(Deal, PendingSuggestion.deal_id == Deal.id)
        .where(PendingSuggestion.status == "pending")
        .order_by(PendingSuggestion.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": s.id,
            "deal_id": s.deal_id,
            "company_name": d.company_name,
            "stage": d.stage,
            "suggested_field": s.suggested_field,
            "suggested_value": s.suggested_value,
            "claude_summary": s.claude_summary,
            "email_subject": s.email_subject,
            "current_commentary": d.commentary,
            "created_at": s.created_at.isoformat(),
        }
        for s, d in rows
    ]


class ApproveRequest(BaseModel):
    reviewer: str = "user"
    value: str | None = None  # optional edited value; falls back to suggestion.suggested_value


@router.post("/review-queue/{suggestion_id}/approve")
async def approve_suggestion(
    suggestion_id: int,
    body: ApproveRequest = ApproveRequest(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PendingSuggestion).where(
            PendingSuggestion.id == suggestion_id,
            PendingSuggestion.status == "pending",
        )
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found or already reviewed")

    deal_res = await db.execute(select(Deal).where(Deal.id == suggestion.deal_id))
    deal = deal_res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    new_line = body.value if body.value is not None else suggestion.suggested_value

    if suggestion.suggested_field == "commentary":
        existing = deal.commentary or ""
        final_value = f"{existing}\n{new_line}".strip() if existing else (new_line or "")
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

    suggestion.status = "approved"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by = body.reviewer

    return {"ok": True, "deal_id": deal.id, "company_name": deal.company_name}


@router.post("/review-queue/{suggestion_id}/reject")
async def reject_suggestion(
    suggestion_id: int,
    reviewer: str = "user",
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PendingSuggestion).where(
            PendingSuggestion.id == suggestion_id,
            PendingSuggestion.status == "pending",
        )
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found or already reviewed")

    suggestion.status = "rejected"
    suggestion.reviewed_at = datetime.now(timezone.utc)
    suggestion.reviewed_by = "user"

    return {"ok": True, "suggestion_id": suggestion_id}


@router.get("/analytics")
async def get_analytics(db: AsyncSession = Depends(get_db)):
    all_deals = (await db.execute(select(Deal))).scalars().all()
    funnel = {
        "total_reviewed": len(all_deals),
        "nda_signed": sum(1 for d in all_deals if d.nda == "P"),
        "closed": sum(1 for d in all_deals if d.bucket == "Closed"),
    }

    pass_rows = await db.execute(
        text(
            "SELECT reasons_for_passing, COUNT(*) AS cnt FROM deals "
            "WHERE bucket='Dead-Hold' AND reasons_for_passing IS NOT NULL AND reasons_for_passing != '' "
            "GROUP BY reasons_for_passing ORDER BY cnt DESC"
        )
    )
    pass_reasons = [{"reason": row[0], "count": int(row[1])} for row in pass_rows]

    source_rows = await db.execute(
        text(
            "SELECT source, COUNT(*) AS cnt FROM deals "
            "WHERE source IS NOT NULL AND source != '' "
            "GROUP BY source ORDER BY cnt DESC"
        )
    )
    deal_sources = [{"source": row[0], "count": int(row[1])} for row in source_rows]

    quarter_rows = await db.execute(
        text(
            "SELECT timing_qtr, COUNT(*) AS cnt FROM deals "
            "WHERE timing_qtr IS NOT NULL AND timing_qtr != '' "
            "GROUP BY timing_qtr ORDER BY timing_qtr"
        )
    )
    deals_by_quarter = [{"quarter": row[0], "count": int(row[1])} for row in quarter_rows]

    return {
        "funnel": funnel,
        "pass_reasons": pass_reasons,
        "deal_sources": deal_sources,
        "deals_by_quarter": deals_by_quarter,
    }


@router.post("/admin/scan")
async def trigger_scan(db: AsyncSession = Depends(get_db)):
    from app.automation.scanner import run_scan
    count = await run_scan(db)
    return {"ok": True, "emails_processed": count}
