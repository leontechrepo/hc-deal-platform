import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PendingSuggestion(Base):
    """AI-proposed deal update awaiting human approval — the Inbox's actionable queue."""

    __tablename__ = "pending_suggestions"
    __table_args__ = (
        Index("idx_ps_status", "status"),
        Index("idx_ps_deal_id", "deal_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=True
    )
    email_scan_log_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("email_scan_log.id", ondelete="SET NULL"), nullable=True)
    suggested_field: Mapped[str] = mapped_column(Text, default="commentary", nullable=False)
    suggested_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    claude_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    email_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, default="email_scan", nullable=False)
    status: Mapped[str] = mapped_column(Text, default="pending", nullable=False)  # pending | approved | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Inbox enrichment (migration 012)
    email_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_size_m: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    estimated_sector: Mapped[str | None] = mapped_column(Text, nullable=True)

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
    thread_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    matched_deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="SET NULL"), nullable=True
    )
    claude_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)  # no_match | queued_for_review | filtered | new_deal_detected
