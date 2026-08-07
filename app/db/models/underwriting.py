import uuid
from datetime import date, datetime, timezone

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, Integer, Numeric, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# create_type=False: type is created by migration 022's raw SQL (contacts).
_DATA_CLASSIFICATION_ENUM = PGEnum("Internal", "PII", "MNPI", "LP", name="data_classification_enum", create_type=False)


class UnderwritingAssumption(Base):
    """Versioned, append-only underwriting history layered alongside the
    existing flat one-shot fields on Deal (left untouched — additive only).
    Never delete/update prior versions; app layer assigns the next version
    number, enforced by UNIQUE(deal_id, version)."""

    __tablename__ = "underwriting_assumptions"
    __table_args__ = (
        Index("idx_underwriting_assumptions_deal_id", "deal_id"),
        UniqueConstraint("deal_id", "version"),
    )

    underwriting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    ebitda: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # cents
    revenue: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # cents
    total_leverage_multiple: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    senior_leverage_multiple: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    interest_coverage_ratio: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    base_rate: Mapped[str | None] = mapped_column(Text, nullable=True)
    spread_bps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    oid: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    ticking_fee: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    maturity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    tenor_years: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    amortization_schedule: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    call_protection: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_score: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    scoring_weights: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    data_classification: Mapped[str] = mapped_column(_DATA_CLASSIFICATION_ENUM, default="Internal", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
