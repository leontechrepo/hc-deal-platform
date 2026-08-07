import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Union of the original taxonomy and Corporate Credit Data Model v0.2's
# private-credit taxonomy — must stay in sync with migration 035's CHECK
# and frontend/src/types.ts's DOCUMENT_CATEGORIES.
DOCUMENT_CATEGORIES: list[str] = [
    "Sourcing", "Intake", "NDA", "Screening", "LOI", "Diligence",
    "IC Memo", "Credit Agreement", "Closing",
    "CIM", "QoE Report", "Management Presentation", "Term Sheet",
    "Board Consent", "Compliance Certificate",
]

PROCESSING_STATUSES: list[str] = ["pending", "extracted", "needs_review"]


class DealDocument(Base):
    __tablename__ = "deal_documents"
    __table_args__ = (
        Index("idx_deal_documents_deal_id", "deal_id"),
        Index("idx_deal_documents_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    doc_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    storage_backend: Mapped[str] = mapped_column(Text, default="railway_bucket", nullable=False)
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="active", nullable=False)  # active | deleted
    uploaded_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "extraction_results" per the site is folded into deal_documents, not a
    # separate table (migration 035).
    processing_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    extraction_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    human_review_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
