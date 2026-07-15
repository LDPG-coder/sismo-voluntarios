from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.models._base import Base, IdMixin, TenantMixin, TimestampMixin


class ActivityEvidence(Base, IdMixin, TimestampMixin, TenantMixin):
    """Comprobante fotografico subido por el organizador de una actividad.

    Las imagenes se almacenan como data URL (igual que la constancia del
    voluntariado oficial externo) para evitar gestionar un bucket externo. El
    acceso de escritura es exclusivo del creador y solo mientras la actividad
    este iniciada y no cerrada; la lectura queda abierta a cualquier usuario
    autenticado que pueda ver la actividad.
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
    image_url = Column(Text, nullable=False)
