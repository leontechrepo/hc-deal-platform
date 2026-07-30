from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Index, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Sponsor(Base):
    __tablename__ = "sponsors"
    __table_args__ = (
        Index("idx_sponsors_name", "name"),
        Index("idx_sponsors_email_domain", "email_domain"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    sponsor_type: Mapped[str | None] = mapped_column(Text, nullable=True)  # PE Sponsor | Strategic
    aum_m: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    focus: Mapped[str | None] = mapped_column(Text, nullable=True)
    hq_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    fund_vintage: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_role: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    email_domain: Mapped[str | None] = mapped_column(Text, nullable=True)  # used for scanner auto-suggestion
    coverage_cadence: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_contact_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    relationship_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
