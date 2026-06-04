from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Deal(Base):
    __tablename__ = "deals"
    __table_args__ = (
        Index("idx_deals_stage", "stage"),
        Index("idx_deals_bucket", "bucket"),
        Index("idx_deals_sector_primary", "sector_primary"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Identity
    company_name: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Classification
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

    # Process milestones (P = completed, blank = not yet)
    nda: Mapped[str | None] = mapped_column(Text, nullable=True)
    dataroom: Mapped[str | None] = mapped_column(Text, nullable=True)
    mgmt_meeting: Mapped[str | None] = mapped_column(Text, nullable=True)
    ioi_offered: Mapped[str | None] = mapped_column(Text, nullable=True)
    ioi_signed: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_close: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Commentary (timestamped log from Excel, auto-updated by email scanner)
    commentary: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_updated: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Financials
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
    deal_id: Mapped[int] = mapped_column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    field_changed: Mapped[str] = mapped_column(Text, nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)  # excel_import | email_scan | manual_edit
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    email_subject: Mapped[str | None] = mapped_column(Text, nullable=True)

    deal: Mapped["Deal"] = relationship(back_populates="update_log")


class PendingSuggestion(Base):
    """AI-proposed deal update awaiting human approval."""

    __tablename__ = "pending_suggestions"
    __table_args__ = (
        Index("idx_ps_status", "status"),
        Index("idx_ps_deal_id", "deal_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deal_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=True)
    email_scan_log_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("email_scan_log.id", ondelete="SET NULL"), nullable=True)
    suggested_field: Mapped[str] = mapped_column(Text, default="commentary", nullable=False)
    suggested_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    claude_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    email_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, default="email_scan", nullable=False)
    status: Mapped[str] = mapped_column(Text, default="pending", nullable=False)  # pending | approved | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(Text, nullable=True)

    deal: Mapped["Deal | None"] = relationship("Deal", foreign_keys=[deal_id])


class EmailScanLog(Base):
    __tablename__ = "email_scan_log"
    __table_args__ = (
        UniqueConstraint("graph_message_id", name="uq_email_scan_log_message_id"),
        Index("idx_esl_received_at", "received_at"),
        Index("idx_esl_matched_deal_id", "matched_deal_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    graph_message_id: Mapped[str] = mapped_column(Text, nullable=False)
    user_email: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    matched_deal_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("deals.id", ondelete="SET NULL"), nullable=True)
    claude_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)
