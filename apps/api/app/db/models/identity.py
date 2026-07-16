from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.models._base import Base, IdMixin, TimestampMixin, TenantMixin
from app.db.models.media_asset import MediaAsset
from app.db.enums import UserRole, UserStatus


class User(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    google_subject = Column(String(64), unique=True, nullable=True, index=True)
    # How the account was provisioned: "google" (external/public OAuth) or
    # "sep" (auto-provisioned from the SEP platform). Drives UI chrome
    # (embedded vs full shell) and authorization limits for public users.
    auth_source = Column(String(20), nullable=False, default="google", server_default="google")
    # Stable id of the user in the SEP platform. Unique among SEP-provisioned
    # accounts; null for accounts created via Google OAuth.
    sep_user_id = Column(String(255), unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=True)
    photo_url = Column(Text, nullable=True)
    google_photo_url = Column(Text, nullable=True)
    # Referencia al archivo en el backend de almacenamiento (fuera de la BD).
    # Cuando existe, `photo_url` queda en NULL y la URL se deriva del asset.
    photo_asset_id = Column(
        UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=True, index=True
    )
    photo_asset = relationship("MediaAsset", foreign_keys=[photo_asset_id])
    phone = Column(String(50), nullable=True)
    # Cédula de identidad (documento nacional). Única entre usuarios; se permite
    # NULL porque no todos los usuarios la aportan al registrarse.
    cedula = Column(String(20), unique=True, nullable=True, index=True)
    # Género del usuario (libre: "femenino", "masculino", "otro", etc.).
    gender = Column(String(20), nullable=True)
    # Número de WhatsApp en formato E.164 (p.ej. +584121234567). Separa el
    # contacto de WhatsApp del teléfono general cuando difieren.
    whatsapp = Column(String(50), nullable=True)
    role = Column(String(20), nullable=False, default=UserRole.volunteer.value)
    status = Column(String(20), nullable=False, default=UserStatus.pending.value)
    referral_code = Column(String(20), unique=True, nullable=False, index=True)
    referred_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    referrer = relationship("User", remote_side="User.id", foreign_keys=[referred_by])
