from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.models._base import Base, IdMixin, TimestampMixin, TenantMixin
from app.db.enums import ActivityStatus


class Activity(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "activities"

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    zone = Column(String(100), nullable=False, index=True)
    raw_address = Column(Text, nullable=False)
    date_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    estimated_duration_min = Column(Integer, nullable=True)
    max_participants = Column(Integer, nullable=True)
    requirements = Column(Text, nullable=True)
    contact_info = Column(Text, nullable=True)
    external_beneficiary = Column(String(255), nullable=True)
    external_supervisor = Column(String(255), nullable=True)
    external_supervisor_email = Column(String(255), nullable=True)
    external_assigned_hours = Column(Float, nullable=True)
    external_certificate = Column(Text, nullable=True)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default=ActivityStatus.active.value)
