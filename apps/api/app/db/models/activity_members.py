from __future__ import annotations

from sqlalchemy import Boolean, Column, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.db.models._base import Base, IdMixin, TimestampMixin


class ActivityMember(Base, IdMixin, TimestampMixin):
    __tablename__ = "activity_members"
    __table_args__ = (
        UniqueConstraint("activity_id", "user_id", name="uq_activity_member"),
    )

    activity_id = Column(UUID(as_uuid=True), ForeignKey("activities.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    attended = Column(Boolean, nullable=True, default=None)
