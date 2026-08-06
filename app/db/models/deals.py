import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    ARRAY,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Deal(Base):
    __tablename__ = "credit_deals"
    __table_args__ = (
        Index("idx_credit_deals_stage", "stage"),
        Index("idx_credit_deals_bucket", "bucket"),
        Index("idx_credit_deals_sector_primary", "sector_primary"),
        Index("idx_credit_deals_pipeline_stage", "pipeline_stage"),
        Index("idx_credit_deals_status", "status"),
        Index("idx_credit_deals_sponsor_id", "sponsor_id"),
        Index("idx_credit_deals_fund_id", "fund_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )

    # Identity
    company_name: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Legacy classification (kept as-is — audit trail + backfill input for
    # pipeline_stage/status; the Excel importer still writes these)
    bucket: Mapped[str | None] = mapped_column(Text, nullable=True)  # Closed / Active-Diligence / Active-Discussions / Dead-Hold
    stage: Mapped[str | None] = mapped_column(Text, nullable=True)   # Closed / Pre-LOI Diligence / Initial Conversations / On Hold / Passed
    sector_primary: Mapped[str | None] = mapped_column(Text, nullable=True)
    sector_full: Mapped[str | None] = mapped_column(Text, nullable=True)
    subsector: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Deal characteristics
    deal_size_m: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    security: Mapped[str | None] = mapped_column(Text, nullable=True)
    uop: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    timing_qtr: Mapped[str | None] = mapped_column(Text, nullable=True)
    competition: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Process milestones (P = completed, blank = not yet) — legacy, kept as-is
    nda: Mapped[str | None] = mapped_column(Text, nullable=True)
    dataroom: Mapped[str | None] = mapped_column(Text, nullable=True)
    mgmt_meeting: Mapped[str | None] = mapped_column(Text, nullable=True)
    ioi_offered: Mapped[str | None] = mapped_column(Text, nullable=True)
    ioi_signed: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_close: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Commentary (timestamped log from Excel, auto-updated by email scanner)
    commentary: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_updated: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Financials (legacy Excel-era)
    ltm_revenue_m: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    ltm_ebitda_m: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    ebitda_margin: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    committed_upfront_m: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    committed_ddtl_m: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    total_funded_m: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cash_int_pct: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    pik_int_pct: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    total_int_pct: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)

    # Pass details
    reasons_for_passing: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audit
    updated_by: Mapped[str] = mapped_column(Text, default="excel_import", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    # --- New pipeline model (migration 004) ---
    pipeline_stage: Mapped[str] = mapped_column(Text, nullable=False)  # 11-value funnel, see app/domain/pipeline_stage.py
    status: Mapped[str] = mapped_column(Text, nullable=False)  # Active / On Hold / Passed / Dead / Closed

    # --- New structural/financial/covenant fields (migration 005) ---
    state: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    sourcing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contact_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_role: Mapped[str | None] = mapped_column(Text, nullable=True)
    nda_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    nda_status: Mapped[str | None] = mapped_column(Text, nullable=True)  # Not Started / Sent / Signed
    tenor_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amortization: Mapped[str | None] = mapped_column(Text, nullable=True)
    oid_pct: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    sofr_floor_pct: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    call_protection: Mapped[str | None] = mapped_column(Text, nullable=True)
    maturity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_leverage: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    spread_bps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    base_rate: Mapped[str | None] = mapped_column(Text, nullable=True)
    sofr_rate: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    all_in_rate: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    hold_amount_m: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    revenue_growth_pct: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    ebitda_growth_pct: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    capex_m: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    fcf_m: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    dscr: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    fccr: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    interest_coverage: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    max_leverage_covenant: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    min_fccr_covenant: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    capex_limit_covenant_m: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    employees: Mapped[int | None] = mapped_column(Integer, nullable=True)
    locations_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year_founded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_score: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    deal_team: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)

    # --- Sponsor/Fund references (migration 006) ---
    sponsor_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("sponsors.id", ondelete="SET NULL"), nullable=True)
    fund_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("funds.id", ondelete="SET NULL"), nullable=True)

    update_log: Mapped[list["DealUpdateLog"]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )


class DealUpdateLog(Base):
    __tablename__ = "deal_update_log"
    __table_args__ = (
        Index("idx_dul_deal_id", "deal_id"),
        Index("idx_dul_changed_at", "changed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    field_changed: Mapped[str] = mapped_column(Text, nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)  # excel_import | email_scan | manual_edit
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    email_subject: Mapped[str | None] = mapped_column(Text, nullable=True)

    deal: Mapped["Deal"] = relationship(back_populates="update_log")
