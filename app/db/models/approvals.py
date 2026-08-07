import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# create_type=False: type is created by migration 031's raw SQL.
_APPROVAL_STATUS_ENUM = PGEnum("pending", "approved", "rejected", name="approval_status_enum", create_type=False)


class ApprovalLogEntry(Base):
    """Every deal_stage transition and every deal_status change to
    Passed/Dead/On Hold/Closed gets a row here. `reasoning` is required on
    terminal-status approvals — enforced at the app layer (app/api/approvals.py),
    not a DB CHECK, since "terminal" is a business classification of
    approval_stage that would otherwise duplicate Python logic in the
    constraint itself."""

    __tablename__ = "approval_log"
    __table_args__ = (
        Index("idx_approval_log_deal_id", "deal_id"),
        Index("idx_approval_log_approval_stage", "approval_stage"),
    )

    approval_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="SET NULL"), nullable=True
    )
    approval_stage: Mapped[str] = mapped_column(Text, nullable=False)
    approver: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_status: Mapped[str] = mapped_column(_APPROVAL_STATUS_ENUM, default="pending", nullable=False)
    conditions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
