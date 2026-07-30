from datetime import datetime, timezone

from sqlalchemy import ARRAY, DateTime, ForeignKey, Index, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Fund(Base):
    __tablename__ = "funds"
    __table_args__ = (
        Index("idx_funds_name", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    vintage: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str | None] = mapped_column(Text, nullable=True)  # Investing | Fundraising
    total_commitment_m: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    called_capital_m: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    deployed_capital_m: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    available_capital_m: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    target_return: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategy: Mapped[str | None] = mapped_column(Text, nullable=True)
    focus_sectors: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    max_single_exposure_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    target_leverage: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    target_hold: Mapped[str | None] = mapped_column(Text, nullable=True)
    gp_commitment_m: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    mgmt_fee_pct: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    carried_interest_pct: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    investment_period: Mapped[str | None] = mapped_column(Text, nullable=True)
    fund_life: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    lps: Mapped[list["FundLP"]] = relationship(back_populates="fund", cascade="all, delete-orphan")


class FundLP(Base):
    __tablename__ = "fund_lps"
    __table_args__ = (
        Index("idx_fund_lps_fund_id", "fund_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fund_id: Mapped[int] = mapped_column(Integer, ForeignKey("funds.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    commitment_m: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    called_m: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    fund: Mapped["Fund"] = relationship(back_populates="lps")
