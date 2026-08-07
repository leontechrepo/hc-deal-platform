import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# create_type=False: type is created by migration 023's raw SQL.
_DEAL_TEAM_ROLE_ENUM = PGEnum("Lead", "Analyst", "Associate", name="deal_team_role_enum", create_type=False)


class DealTeamMember(Base):
    """Structured deal-team roster (Lead/Analyst/Associate). Table is named
    deal_team_members, not deal_team — that name collides with the existing
    Deal.deal_team TEXT[] legacy array column, which is left in place."""

    __tablename__ = "deal_team_members"
    __table_args__ = (
        Index("idx_deal_team_members_deal_id", "deal_id"),
    )

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_deals.id", ondelete="CASCADE"), nullable=False
    )
    team_member: Mapped[str] = mapped_column(Text, nullable=False)
    role_on_deal: Mapped[str | None] = mapped_column(_DEAL_TEAM_ROLE_ENUM, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
