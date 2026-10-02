import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ScanRun(Base):
    """One execution of the scanner, with counters and spend."""

    __tablename__ = "scan_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    trigger: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="running")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    users_scanned: Mapped[list[str] | None] = mapped_column(ARRAY(Text))

    messages_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    messages_deduped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    messages_filtered: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    messages_classified: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    suggestions_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    suggestions_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    field_updates_proposed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    field_updates_rejected: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, default=0
    )
    graph_requests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_counts: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error_message: Mapped[str | None] = mapped_column(Text)


class PendingSuggestion(Base):
    """AI-proposed deal update awaiting human approval."""

    __tablename__ = "pending_suggestions"
    __table_args__ = (
        Index("idx_ps_status", "status"),
        Index("idx_ps_deal_id", "deal_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=True
    )
    email_scan_log_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("email_scan_log.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False, default="field_update")
    suggested_field: Mapped[str] = mapped_column(Text, default="commentary", nullable=False)
    suggested_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    claude_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    email_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    requires_attention: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source: Mapped[str] = mapped_column(Text, default="email_scan", nullable=False)
    status: Mapped[str] = mapped_column(Text, default="pending", nullable=False)
    # `uq_pending_suggestions_dedupe` (migration 037) is a partial unique index on
    # this column WHERE status='pending'. The scanner (a later phase) will pass an
    # explicit, thread/field-derived key via app/automation/dedupe.py so related
    # suggestions collapse into one card. Until then, callers that don't pass one
    # (the current scanner, tests) must not collide with each other — a static
    # default like "" would make every second pending row violate that index — so
    # the fallback is a fresh value per row, not a constant.
    dedupe_key: Mapped[str] = mapped_column(
        Text, nullable=False, default=lambda: uuid.uuid4().hex
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(Text, nullable=True)

    email_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_size_m: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    estimated_sector: Mapped[str | None] = mapped_column(Text, nullable=True)

    deal: Mapped["Deal | None"] = relationship("Deal", foreign_keys=[deal_id])


class EmailScanLog(Base):
    __tablename__ = "email_scan_log"
    __table_args__ = (
        UniqueConstraint("user_email", "graph_message_id", name="uq_email_scan_log_user_message"),
        Index("idx_esl_received_at", "received_at"),
        Index("idx_esl_matched_deal_id", "matched_deal_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_runs.id", ondelete="SET NULL"), nullable=True
    )
    graph_message_id: Mapped[str] = mapped_column(Text, nullable=False)
    user_email: Mapped[str] = mapped_column(Text, nullable=False)
    folder: Mapped[str] = mapped_column(Text, nullable=False, default="inbox")
    internet_message_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    thread_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    sender_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    sender_domain: Mapped[str | None] = mapped_column(Text, nullable=True)
    sender_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    has_attachments: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    attachment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attachment_summary: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    matched_deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="SET NULL"), nullable=True
    )
    claude_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    prepared_chars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    change_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_removed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class LLMCall(Base):
    __tablename__ = "llm_calls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    scan_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scan_runs.id", ondelete="CASCADE")
    )
    email_scan_log_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("email_scan_log.id", ondelete="SET NULL")
    )
    extraction_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deal_extraction_runs.id", ondelete="SET NULL")
    )
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    tool_round: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 6), nullable=False, default=0
    )
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    stop_reason: Mapped[str | None] = mapped_column(Text)
    request_id: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


class PendingSuggestionEmailLog(Base):
    """Messages that fed a suggestion (many-to-many provenance)."""

    __tablename__ = "pending_suggestion_email_logs"

    suggestion_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pending_suggestions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    email_scan_log_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("email_scan_log.id", ondelete="CASCADE"),
        primary_key=True,
    )
