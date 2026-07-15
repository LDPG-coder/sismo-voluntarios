from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.models._base import Base, IdMixin, TenantMixin, TimestampMixin
from app.db.models.media_asset import MediaAsset


class ActivityEvidence(Base, IdMixin, TimestampMixin, TenantMixin):
    """Comprobante fotografico subido por el organizador de una actividad.

    La imagen se guarda en el backend de almacenamiento (fuera de la BD) y la
    columna ``image_url`` queda como respaldo de migración: cuando existe el
    ``media_asset``, la URL se deriva del asset y ``image_url`` se mantiene en
    NULL. El acceso de escritura es exclusivo del creador y solo mientras la
    actividad este iniciada y no cerrada; la lectura queda abierta a cualquier
    usuario autenticado que pueda ver la actividad.
    """

    __tablename__ = "activity_evidence"

    activity_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    image_url = Column(Text, nullable=True)
    # Referencia al archivo en el backend de almacenamiento.
    media_asset_id = Column(
        UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=True, index=True
    )
    media_asset = relationship("MediaAsset", foreign_keys=[media_asset_id])
