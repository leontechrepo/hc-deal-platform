import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CapitalStructure(Base):
    """The company's full debt stack, not just LCG's piece. `amount` is
    cents — this table's own literal-spec convention, distinct from the
    rest of the app's NUMERIC-millions fields."""

    __tablename__ = "capital_structure"
    __table_args__ = (
        Index("idx_capital_structure_deal_id", "deal_id"),
    )

    tranche_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    tranche_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    holder: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # cents
    seniority_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_lcg_position: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class ParticipantLender(Base):
    __tablename__ = "participant_lenders"
    __table_args__ = (
        Index("idx_participant_lenders_deal_id", "deal_id"),
    )

    participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    lender_name: Mapped[str] = mapped_column(Text, nullable=False)
    participation_amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # cents
    is_agent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
