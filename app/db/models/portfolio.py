import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PortfolioPosition(Base):
    """1:1 post-close monitoring extension of a Deal (not a parallel entity)."""

    __tablename__ = "portfolio_positions"
    __table_args__ = (
        Index("idx_portfolio_positions_deal_id", "deal_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    funded_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    original_amount_m: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    current_balance_m: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    rate: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    payment_status: Mapped[str | None] = mapped_column(Text, nullable=True)  # Current | PIK | Past Due | Default
    risk: Mapped[str | None] = mapped_column(Text, nullable=True)  # Pass | Watch
    next_test_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    covenant_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    leverage: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    dscr: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    # Exit/repayment tracking (Corporate Credit Data Model v0.2)
    repayment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    repayment_type: Mapped[str | None] = mapped_column(Text, nullable=True)  # maturity|prepayment|refinance|restructuring|write_off
    realized_irr: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    moic: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class PortfolioMonitoringTest(Base):
    """Functionally this app's covenant_test_results — reused rather than
    duplicated with a separate Part-2 table (see covenant_id below)."""

    __tablename__ = "portfolio_monitoring_tests"
    __table_args__ = (
        Index("idx_portfolio_tests_position_id", "portfolio_position_id"),
        Index("idx_portfolio_monitoring_tests_covenant_id", "covenant_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    portfolio_position_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("portfolio_positions.id", ondelete="CASCADE"), nullable=False
    )
    test_date: Mapped[date] = mapped_column(Date, nullable=False)
    leverage: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    dscr: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    fccr: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    covenant_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optional link to a specific Covenant, once one exists for the deal.
    covenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("covenants.covenant_id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
