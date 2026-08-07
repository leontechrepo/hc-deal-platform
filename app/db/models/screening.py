import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# create_type=False: types are created by migration 028's raw SQL.
_RECOMMENDATION_ENUM = PGEnum("go", "no_go", "hold", name="screening_recommendation_enum", create_type=False)
_STATUS_ENUM = PGEnum("draft", "decided", name="screening_status_enum", create_type=False)
_DATA_CLASSIFICATION_ENUM = PGEnum("Internal", "PII", "MNPI", "LP", name="data_classification_enum", create_type=False)


class ScreeningMemo(Base):
    """Versioned, append-only — drafted against the memo-library corpus,
    never overwritten. No existing analog; genuinely new capability."""

    __tablename__ = "screening_memos"
    __table_args__ = (
        Index("idx_screening_memos_deal_id", "deal_id"),
        UniqueConstraint("deal_id", "version"),
    )

    memo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    recommendation: Mapped[str | None] = mapped_column(_RECOMMENDATION_ENUM, nullable=True)
    memo_doc_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    corpus_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(_STATUS_ENUM, default="draft", nullable=False)
    data_classification: Mapped[str] = mapped_column(_DATA_CLASSIFICATION_ENUM, default="Internal", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
