from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, text, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.activity import log_activity
from app.db.models import Deal, DealUpdateLog, EmailScanLog
from app.db.models.portfolio import PortfolioPosition
from app.db.session import get_db
from app.domain.pipeline_stage import (
    PIPELINE_STAGES,
    STATUSES,
    UNDERWRITING_FIELDS,
    is_underwriting_locked,
)

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])

# Legacy fields (kept editable — the old Dashboard's inline-edit still targets
# these) plus every new structural/financial/covenant field from migration 005
# and the new pipeline_stage/status columns from migration 004.
EDITABLE_FIELDS = {
    "company_name", "location", "stage", "sector_primary", "sector_full",
    "subsector", "deal_size_m", "security", "uop", "source", "commentary",
    "reasons_for_passing", "bucket",
    "pipeline_stage", "status",
    "state", "next_action", "sourcing_date", "contact_name", "contact_role",
    "nda_date", "nda_status", "tenor_months", "amortization", "oid_pct",
    "sofr_floor_pct", "call_protection", "maturity_date", "total_leverage",
    "spread_bps", "base_rate", "sofr_rate", "all_in_rate", "hold_amount_m",
    "revenue_growth_pct", "ebitda_growth_pct", "capex_m", "fcf_m", "dscr",
    "fccr", "interest_coverage", "max_leverage_covenant", "min_fccr_covenant",
    "capex_limit_covenant_m", "employees", "locations_count", "year_founded",
    "risk_score", "ltm_revenue_m", "ltm_ebitda_m", "ebitda_margin",
}

_DATE_FIELDS = {"target_close", "sourcing_date", "nda_date", "maturity_date"}
_NUMERIC_FIELDS = {
    "deal_size_m", "total_funded_m", "ltm_revenue_m", "ltm_ebitda_m", "ebitda_margin",
    "oid_pct", "sofr_floor_pct", "total_leverage", "sofr_rate", "all_in_rate",
    "hold_amount_m", "revenue_growth_pct", "ebitda_growth_pct", "capex_m", "fcf_m",
    "dscr", "fccr", "interest_coverage", "max_leverage_covenant", "min_fccr_covenant",
    "capex_limit_covenant_m", "risk_score",
}
_INT_FIELDS = {"tenor_months", "spread_bps", "employees", "locations_count", "year_founded"}


def _coerce_field_value(field: str, value):
    if value is None or value == "":
        return None
    if field in _DATE_FIELDS:
        return value if isinstance(value, date) else date.fromisoformat(str(value))
    if field in _NUMERIC_FIELDS:
        return float(value)
    if field in _INT_FIELDS:
        return int(value)
    return value


class PatchRequest(BaseModel):
    field: str
    value: str | float | int | None = None


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

    if body.field in UNDERWRITING_FIELDS and is_underwriting_locked(deal.pipeline_stage):
        raise HTTPException(
            status_code=409,
            detail=(
                f"'{body.field}' is locked — underwriting fields become read-only once a "
                "deal reaches loi_signed or later. Contact an admin to unlock."
            ),
        )
    if body.field == "pipeline_stage" and body.value not in PIPELINE_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid pipeline_stage: {body.value!r}")
    if body.field == "status" and body.value not in STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.value!r}")

    old_value = str(getattr(deal, body.field)) if getattr(deal, body.field) is not None else None

    try:
        coerced = _coerce_field_value(body.field, body.value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid value for '{body.field}': {exc}")

    setattr(deal, body.field, coerced)
    deal.updated_by = "manual_edit"
    deal.updated_at = datetime.now(timezone.utc)

    log = DealUpdateLog(
        deal_id=deal_id,
        field_changed=body.field,
        old_value=old_value,
        new_value=str(coerced) if coerced is not None else None,
        source="manual_edit",
    )
    db.add(log)

    if body.field == "pipeline_stage" and coerced == "portfolio_monitoring":
        await _ensure_portfolio_position(deal, db)

    activity_type = "stage_change" if body.field in ("pipeline_stage", "stage", "bucket") else \
        "status_change" if body.field == "status" else "system"
    await log_activity(
        db, deal_id, "user", activity_type,
        f"{body.field} changed from {old_value!r} to {coerced!r}",
    )

    return {"ok": True, "deal_id": deal_id, "field": body.field, "value": coerced}


async def _ensure_portfolio_position(deal: Deal, db: AsyncSession) -> None:
    """Stub-create a PortfolioPosition the first time a deal reaches portfolio_monitoring."""
    existing = await db.execute(select(PortfolioPosition).where(PortfolioPosition.deal_id == deal.id))
    if existing.scalar_one_or_none():
        return
    db.add(PortfolioPosition(
        deal_id=deal.id,
        funded_date=date.today(),
        original_amount_m=deal.deal_size_m,
        current_balance_m=deal.deal_size_m,
        rate=deal.all_in_rate,
        payment_status="Current",
        risk="Pass",
        leverage=deal.total_leverage,
        dscr=deal.dscr,
    ))


def _deal_to_dict(d: Deal) -> dict:
    return {
        "id": d.id,
        "company_name": d.company_name,
        "bucket": d.bucket,
        "stage": d.stage,
        "location": d.location,
        "deal_size_m": float(d.deal_size_m) if d.deal_size_m is not None else None,
        "sector_primary": d.sector_primary,
        "sector_full": d.sector_full,
        "subsector": d.subsector,
        "security": d.security,
        "uop": d.uop,
        "source": d.source,
        "timing_qtr": d.timing_qtr,
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
        "total_funded_m": float(d.total_funded_m) if d.total_funded_m is not None else None,
        # Pipeline model
        "pipeline_stage": d.pipeline_stage,
        "status": d.status,
        # Structural / financial / covenant fields
        "state": d.state,
        "next_action": d.next_action,
        "sourcing_date": d.sourcing_date.isoformat() if d.sourcing_date else None,
        "contact_name": d.contact_name,
        "contact_role": d.contact_role,
        "nda_date": d.nda_date.isoformat() if d.nda_date else None,
        "nda_status": d.nda_status,
        "tenor_months": d.tenor_months,
        "amortization": d.amortization,
        "oid_pct": float(d.oid_pct) if d.oid_pct is not None else None,
        "sofr_floor_pct": float(d.sofr_floor_pct) if d.sofr_floor_pct is not None else None,
        "call_protection": d.call_protection,
        "maturity_date": d.maturity_date.isoformat() if d.maturity_date else None,
        "total_leverage": float(d.total_leverage) if d.total_leverage is not None else None,
        "spread_bps": d.spread_bps,
        "base_rate": d.base_rate,
        "sofr_rate": float(d.sofr_rate) if d.sofr_rate is not None else None,
        "all_in_rate": float(d.all_in_rate) if d.all_in_rate is not None else None,
        "hold_amount_m": float(d.hold_amount_m) if d.hold_amount_m is not None else None,
        "ltm_revenue_m": float(d.ltm_revenue_m) if d.ltm_revenue_m is not None else None,
        "ltm_ebitda_m": float(d.ltm_ebitda_m) if d.ltm_ebitda_m is not None else None,
        "ebitda_margin": float(d.ebitda_margin) if d.ebitda_margin is not None else None,
        "revenue_growth_pct": float(d.revenue_growth_pct) if d.revenue_growth_pct is not None else None,
        "ebitda_growth_pct": float(d.ebitda_growth_pct) if d.ebitda_growth_pct is not None else None,
        "capex_m": float(d.capex_m) if d.capex_m is not None else None,
        "fcf_m": float(d.fcf_m) if d.fcf_m is not None else None,
        "dscr": float(d.dscr) if d.dscr is not None else None,
        "fccr": float(d.fccr) if d.fccr is not None else None,
        "interest_coverage": float(d.interest_coverage) if d.interest_coverage is not None else None,
        "max_leverage_covenant": float(d.max_leverage_covenant) if d.max_leverage_covenant is not None else None,
        "min_fccr_covenant": float(d.min_fccr_covenant) if d.min_fccr_covenant is not None else None,
        "capex_limit_covenant_m": float(d.capex_limit_covenant_m) if d.capex_limit_covenant_m is not None else None,
        "employees": d.employees,
        "locations_count": d.locations_count,
        "year_founded": d.year_founded,
        "risk_score": float(d.risk_score) if d.risk_score is not None else None,
        "deal_team": d.deal_team,
        "underwriting_locked": is_underwriting_locked(d.pipeline_stage),
    }


@router.get("/deals")
async def list_deals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal).order_by(Deal.bucket, Deal.company_name))
    deals = result.scalars().all()
    return [_deal_to_dict(d) for d in deals]


@router.get("/deals/{deal_id}")
async def get_deal(deal_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return _deal_to_dict(deal)


class CreateDealRequest(BaseModel):
    company_name: str
    location: Optional[str] = None
    sector_primary: Optional[str] = None
    sector_full: Optional[str] = None
    subsector: Optional[str] = None
    security: Optional[str] = None
    uop: Optional[str] = None
    source: Optional[str] = None
    pipeline_stage: str = "sourcing"
    status: str = "Active"
    state: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    employees: Optional[int] = None
    locations_count: Optional[int] = None
    year_founded: Optional[int] = None
    deal_size_m: Optional[float] = None
    hold_amount_m: Optional[float] = None
    tenor_months: Optional[int] = None
    oid_pct: Optional[float] = None
    spread_bps: Optional[int] = None
    base_rate: Optional[str] = "SOFR"
    sofr_rate: Optional[float] = None
    sofr_floor_pct: Optional[float] = None
    ltm_revenue_m: Optional[float] = None
    ltm_ebitda_m: Optional[float] = None
    capex_m: Optional[float] = None
    ebitda_margin: Optional[float] = None
    revenue_growth_pct: Optional[float] = None
    max_leverage_covenant: Optional[float] = None
    min_fccr_covenant: Optional[float] = None
    capex_limit_covenant_m: Optional[float] = None


@router.post("/deals")
async def create_deal(body: CreateDealRequest, db: AsyncSession = Depends(get_db)):
    if body.pipeline_stage not in PIPELINE_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid pipeline_stage: {body.pipeline_stage!r}")
    if body.status not in STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status!r}")

    # Derived fields computed the same way the mockup's New Deal form does,
    # so a freshly-created deal shows a sensible leverage/all-in-rate immediately.
    all_in_rate = None
    if body.sofr_rate is not None and body.spread_bps is not None:
        all_in_rate = round(body.sofr_rate + body.spread_bps / 100, 4)
    total_leverage = None
    if body.deal_size_m is not None and body.ltm_ebitda_m:
        total_leverage = round(body.deal_size_m / body.ltm_ebitda_m, 2)

    deal = Deal(
        company_name=body.company_name,
        location=body.location,
        sector_primary=body.sector_primary,
        sector_full=body.sector_full,
        subsector=body.subsector,
        security=body.security,
        uop=body.uop,
        source=body.source,
        bucket="Active-Discussions",
        stage="Initial Conversations",
        pipeline_stage=body.pipeline_stage,
        status=body.status,
        state=body.state,
        contact_name=body.contact_name,
        contact_role=body.contact_role,
        employees=body.employees,
        locations_count=body.locations_count,
        year_founded=body.year_founded,
        deal_size_m=body.deal_size_m,
        hold_amount_m=body.hold_amount_m,
        tenor_months=body.tenor_months,
        oid_pct=body.oid_pct,
        spread_bps=body.spread_bps,
        base_rate=body.base_rate,
        sofr_rate=body.sofr_rate,
        sofr_floor_pct=body.sofr_floor_pct,
        all_in_rate=all_in_rate,
        total_leverage=total_leverage,
        ltm_revenue_m=body.ltm_revenue_m,
        ltm_ebitda_m=body.ltm_ebitda_m,
        capex_m=body.capex_m,
        ebitda_margin=body.ebitda_margin,
        revenue_growth_pct=body.revenue_growth_pct,
        max_leverage_covenant=body.max_leverage_covenant,
        min_fccr_covenant=body.min_fccr_covenant,
        capex_limit_covenant_m=body.capex_limit_covenant_m,
        updated_by="manual_edit",
    )
    db.add(deal)
    await db.flush()

    db.add(DealUpdateLog(
        deal_id=deal.id,
        field_changed="pipeline_stage",
        old_value=None,
        new_value=deal.pipeline_stage,
        source="manual_edit",
    ))
    await log_activity(db, deal.id, "user", "system", "Deal created — entered via New Deal form")

    return {"ok": True, "deal_id": deal.id, "company_name": deal.company_name}


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
            "GROUP BY source ORDER BY cnt DESC LIMIT 12"
        )
    )
    deal_sources = [{"source": row[0], "count": int(row[1])} for row in source_rows]

    quarter_rows = await db.execute(
        text(
            "SELECT timing_qtr, COUNT(*) AS cnt FROM deals "
            "WHERE timing_qtr IS NOT NULL AND timing_qtr != '' "
            "GROUP BY timing_qtr ORDER BY SUBSTRING(timing_qtr FROM 4), LEFT(timing_qtr, 1)"
        )
    )
    deals_by_quarter = [{"quarter": row[0], "count": int(row[1])} for row in quarter_rows]

    return {
        "funnel": funnel,
        "pass_reasons": pass_reasons,
        "deal_sources": deal_sources,
        "deals_by_quarter": deals_by_quarter,
    }
