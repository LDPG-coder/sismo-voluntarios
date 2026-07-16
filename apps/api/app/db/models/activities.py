from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.enums import ActivityStatus
from app.db.models._base import Base, IdMixin, TenantMixin, TimestampMixin


class Activity(Base, IdMixin, TimestampMixin, TenantMixin):
    __tablename__ = "activities"

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    zone = Column(String(100), nullable=False, index=True)
    raw_address = Column(Text, nullable=False)
    date_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    estimated_duration_min = Column(Integer, nullable=True)
    # Horas realmente realizadas de la actividad. Siempre definido para
    # cualquier tipo (interna/oficial/registro previo): se deriva de la
    # diferencia end_time - date_time, o de estimated_duration_min, o de
    # external_assigned_hours. Ver _compute_realized_hours().
    realized_hours = Column(Float, nullable=True)
    max_participants = Column(Integer, nullable=True)
    requirements = Column(Text, nullable=True)
    contact_info = Column(Text, nullable=True)
    external_beneficiary = Column(String(255), nullable=True)
    external_supervisor = Column(String(255), nullable=True)
    external_supervisor_email = Column(String(255), nullable=True)
    external_assigned_hours = Column(Float, nullable=True)
    external_certificate = Column(Text, nullable=True)
    # Datos relevantes libres que el becario adjunta al enviar la actividad
    # externa a validacion (contexto, logros, observaciones, etc.).
    external_relevant_data = Column(Text, nullable=True)
    # Referencia al PDF en el backend de almacenamiento (fuera de la BD).
    certificate_asset_id = Column(
        UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=True, index=True
    )
    certificate_asset = relationship("MediaAsset", foreign_keys=[certificate_asset_id])
    # Voluntariado interno: tareas rapidas publicadas por coordinadores/becarios
    # de AVAA que SUMAN horas al programa. Excluyente con el voluntariado externo
    # oficial (si is_internal=True, los campos external_* van vacios).
    is_internal = Column(Boolean, nullable=False, default=False, server_default="false")
    # Registro de una actividad ya realizada: privada del becario que la creo.
    # No aparece en el listado publico, no acepta participantes y no es visible
    # para otros usuarios; se usa unicamente para validar horas externas.
    is_private = Column(Boolean, nullable=False, default=False, server_default="false")
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Flujo de validacion de actividades externas: cuando un administrador
    # valida la actividad (status=validated) se registran fecha y responsable.
    validated_at = Column(DateTime(timezone=True), nullable=True)
    validated_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    validated_by_user = relationship("User", foreign_keys=[validated_by])
    # Notas del administrador: motivo de rechazo o comentarios de validacion.
    validation_notes = Column(Text, nullable=True)

    status = Column(String(20), nullable=False, default=ActivityStatus.active.value)


def _compute_realized_hours(a: "Activity") -> float | None:
    """Horas realizadas de la actividad, definidas para cualquier tipo.

    Prioridad: (end_time - date_time) en horas -> estimated_duration_min/60
    -> external_assigned_hours. Devuelve None solo si no hay ninguna fuente.
    """
    if a.end_time and a.date_time:
        delta = a.end_time - a.date_time
        hours = delta.total_seconds() / 3600
        if hours is not None and hours >= 0:
            return round(hours, 2)
    if a.estimated_duration_min:
        return round(a.estimated_duration_min / 60, 2)
    if a.external_assigned_hours is not None:
        return round(a.external_assigned_hours, 2)
    return None

