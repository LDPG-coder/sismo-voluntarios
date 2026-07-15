"""Referencias a archivos multimedia almacenados fuera de la base de datos.

Cada fila apunta a un archivo en el backend de almacenamiento (hoy el
sistema de archivos local del servidor) mediante una ``reference`` opaca. La
BD nunca guarda el binario: solo metadatos y la ruta/identificador necesarios
para recuperarlo. Los tipos de dueño se documentan en ``MediaOwnerType``.
"""

from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.models._base import Base, IdMixin, TenantMixin, TimestampMixin


class MediaOwnerType:
    """Tipos de entidad dueña de un asset (clave de ``owner_type``)."""

    USER_PHOTO = "user_photo"
    ACTIVITY_EVIDENCE = "activity_evidence"
    ACTIVITY_CERTIFICATE = "activity_certificate"
    INCUBATOR_ATTACHMENT = "incubator_attachment"


class MediaAsset(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "media_assets"
    __table_args__ = (
        Index(
            "ix_media_assets_owner",
            "owner_type",
            "owner_id",
        ),
    )

    owner_type = Column(String(40), nullable=False)
    owner_id = Column(UUID(as_uuid=True), nullable=False)
    kind = Column(String(20), nullable=False)  # image | document | pdf
    filename = Column(String(255), nullable=True)
    content_type = Column(String(100), nullable=True)
    byte_size = Column(Integer, nullable=True)
    backend = Column(String(20), nullable=False, default="local")
    reference = Column(Text, nullable=False)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)


__all__ = ["MediaAsset", "MediaOwnerType"]
