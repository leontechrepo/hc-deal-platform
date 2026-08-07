import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RiskRating(Base):
    """Judgment-based internal rating, separate from raw covenant pass/fail —
    dated time series layered alongside the existing flat one-shot
    Deal.risk_score (left untouched — additive only)."""

    __tablename__ = "risk_ratings"
    __table_args__ = (
        Index("idx_risk_ratings_deal_id", "deal_id"),
    )

    rating_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    rating_date: Mapped[date] = mapped_column(Date, nullable=False)
    risk_grade: Mapped[str | None] = mapped_column(Text, nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
