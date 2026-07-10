from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.models._base import Base, IdMixin, TimestampMixin, TenantMixin
from app.db.enums import UserRole, UserStatus


class User(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    google_subject = Column(String(64), unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=True)
    photo_url = Column(Text, nullable=True)
    role = Column(String(20), nullable=False, default=UserRole.volunteer.value)
    status = Column(String(20), nullable=False, default=UserStatus.pending.value)
    referral_code = Column(String(20), unique=True, nullable=False, index=True)
    referred_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    referrer = relationship("User", remote_side="User.id", foreign_keys=[referred_by])
