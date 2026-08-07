import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, Text, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# create_type=False: types are created by migration 029's raw SQL.
_COVENANT_TYPE_ENUM = PGEnum("Financial", "Negative", "Affirmative", name="covenant_type_enum", create_type=False)
_TEST_FREQUENCY_ENUM = PGEnum("Quarterly", "Monthly", "Annual", name="covenant_test_frequency_enum", create_type=False)


class Covenant(Base):
    """Financial covenants have a threshold and a test schedule; negative
    and affirmative covenants are compliance checklist items, not numeric
    tests — enforced by a DB CHECK (chk_covenants_threshold_financial_only)."""

    __tablename__ = "covenants"
    __table_args__ = (
        Index("idx_covenants_deal_id", "deal_id"),
    )

    covenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    covenant_type: Mapped[str] = mapped_column(_COVENANT_TYPE_ENUM, nullable=False)
    covenant_name: Mapped[str] = mapped_column(Text, nullable=False)
    threshold_value: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    test_frequency: Mapped[str | None] = mapped_column(_TEST_FREQUENCY_ENUM, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
