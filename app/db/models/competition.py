import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# create_type=False: type is created by migration 024's raw SQL.
_COMPETITION_LEVEL_ENUM = PGEnum("Low", "Medium", "High", name="competition_level_enum", create_type=False)


class CompetitionAssessment(Base):
    """Append-only time series — reassessed per stage, since competitive
    intensity shifts between LOI and closing. deal_stage is a free-text
    snapshot of the stage at assessment time, not a live FK."""

    __tablename__ = "competition_assessments"
    __table_args__ = (
        Index("idx_competition_assessments_deal_id", "deal_id"),
    )

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    deal_stage: Mapped[str | None] = mapped_column(Text, nullable=True)
    competition_level: Mapped[str | None] = mapped_column(_COMPETITION_LEVEL_ENUM, nullable=True)
    assessed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
