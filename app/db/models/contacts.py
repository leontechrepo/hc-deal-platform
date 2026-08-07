import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# create_type=False: these native Postgres enum types are created by their
# migration (raw SQL), not by SQLAlchemy — this only tells the driver the
# real DBAPI type so bind parameters get the right cast (::contact_role_enum,
# not ::VARCHAR, which Postgres refuses to implicitly assign to an enum).
_CONTACT_ROLE_ENUM = PGEnum(
    "CEO", "CFO", "COO", "Board Member", "Sponsor Partner",
    "Banker/Intermediary", "Legal Counsel", "Auditor/QoE Provider",
    name="contact_role_enum", create_type=False,
)
_DATA_CLASSIFICATION_ENUM = PGEnum("Internal", "PII", "MNPI", "LP", name="data_classification_enum", create_type=False)


class Contact(Base):
    """Links to a company, a sponsor, or a specific deal — all nullable and
    independent (a CFO ties to the company generally; a banker contact can
    tie to one deal specifically). The one Part-2 table classified PII."""

    __tablename__ = "contacts"
    __table_args__ = (
        Index("idx_contacts_company_id", "company_id"),
        Index("idx_contacts_sponsor_id", "sponsor_id"),
        Index("idx_contacts_deal_id", "deal_id"),
    )

    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.company_id", ondelete="SET NULL"), nullable=True
    )
    # Matches sponsors.id's existing Integer PK — not UUID, even though this
    # table's own PK is UUID.
    sponsor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sponsors.id", ondelete="SET NULL"), nullable=True
    )
    deal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str | None] = mapped_column(_CONTACT_ROLE_ENUM, nullable=True)
    cadence_frequency: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_interaction_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_touchpoint_due: Mapped[date | None] = mapped_column(Date, nullable=True)
    draft_followup_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_classification: Mapped[str] = mapped_column(_DATA_CLASSIFICATION_ENUM, default="PII", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
