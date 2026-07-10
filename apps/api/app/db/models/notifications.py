"""Notification model."""

from __future__ import annotations

from sqlalchemy import Boolean, Column, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.models._base import Base, IdMixin, TimestampMixin


class Notification(Base, IdMixin, TimestampMixin):
    __tablename__ = "notifications"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("activities.id"), nullable=True, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, nullable=False, default=False)
