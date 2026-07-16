"""Exportación de reporte de becarios (Excel + comprobantes en ZIP).

Endpoint admin-only que genera un reporte filtrable (por becario, fecha,
período, institución y estado) con una fila por actividad, incluyendo datos
del becario creador, horas realizadas, estado de validación y los enlaces /
referencias a los comprobantes (evidencias y certificado). El ZIP incluye
también los archivos multimedia referenciados.
"""

from __future__ import annotations

import io
import zipfile
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

import openpyxl
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import Date, cast, or_, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.base import get_db
from app.db.models.activities import Activity
from app.db.models.activity_evidence import ActivityEvidence
from app.db.models.identity import User
from app.db.models.media_asset import MediaAsset
from app.pipeline.dependencies import require_admin_session
from app.storage.service import media_url

_log = get_logger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


_STATUS_LABELS: dict[str, str] = {
    "active": "Programada",
    "archived": "Realizada",
    "cancelled": "Cancelada",
    "pending_validation": "Pendiente",
    "validated": "Validada",
}


def _type_label(a: Activity) -> str:
    if a.is_internal:
        return "Interno"
    if a.external_beneficiary:
        return "Oficial"
    if a.is_private:
        return "Registro previo"
    return "ProExcelencia"


def _parse_date(value: str | None, field: str) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{field} debe tener formato AAAA-MM-DD") from exc


@router.get("/export")
def export_report(
    admin: Annotated[User, Depends(require_admin_session)],
    db: Annotated[Session, Depends(get_db)],
    becario: str | None = Query(default=None, description="Email, nombre o id del becario creador"),
    fecha: str | None = Query(default=None, description="Fecha exacta (AAAA-MM-DD) de la actividad"),
    desde: str | None = Query(default=None, description="Inicio del período (AAAA-MM-DD)"),
    hasta: str | None = Query(default=None, description="Fin del período (AAAA-MM-DD)"),
    institucion: str | None = Query(default=None, description="Beneficiario externo (ILIKE)"),
    estado: str | None = Query(default=None, description="Estado de la actividad"),
) -> StreamingResponse:
    """Reporte de actividades por becario con comprobantes, en un ZIP (xlsx + media)."""
    fecha_d = _parse_date(fecha, "fecha")
    desde_d = _parse_date(desde, "desde")
    hasta_d = _parse_date(hasta, "hasta")

    q = select(Activity).join(User, Activity.creator_id == User.id)
    if estado:
        q = q.where(Activity.status == estado)
    if institucion:
        q = q.where(Activity.external_beneficiary.ilike(f"%{institucion}%"))
    if fecha_d is not None:
        q = q.where(cast(Activity.date_time, Date) == fecha_d)
    if desde_d is not None:
        q = q.where(Activity.date_time >= datetime.combine(desde_d, datetime.min.time(), tzinfo=UTC))
    if hasta_d is not None:
        end = datetime.combine(hasta_d, datetime.max.time(), tzinfo=UTC)
        q = q.where(Activity.date_time <= end)
    if becario:
        try:
            from uuid import UUID

            becario_uuid = UUID(becario)
            q = q.where(Activity.creator_id == becario_uuid)
        except (ValueError, AttributeError):
            like = f"%{becario}%"
            q = q.where(
                or_(
                    User.email.ilike(like),
                    User.name.ilike(like),
                    User.sep_user_id.ilike(like),
                )
            )

    activities = db.execute(q.order_by(Activity.date_time.desc())).scalars().all()

    # --- Construir filas del reporte ---
    rows: list[dict] = []

    for a in activities:
        creator = db.get(User, a.creator_id)
        evidence_rows = db.execute(
            select(ActivityEvidence).where(ActivityEvidence.activity_id == a.id)
        ).scalars().all()

        evidence_urls: list[str] = []
        evidence_refs: list[str] = []
        for ev in evidence_rows:
            if not ev.media_asset_id:
                continue
            asset = db.get(MediaAsset, ev.media_asset_id)
            if not asset or asset.deleted_at is not None:
                continue
            url = media_url(asset)
            if url:
                evidence_urls.append(url)
            if asset.reference:
                evidence_refs.append(asset.reference)

        cert_ref: str | None = None
        cert_url: str | None = None
        if a.certificate_asset:
            cert_url = media_url(a.certificate_asset)
            if a.certificate_asset.reference:
                cert_ref = a.certificate_asset.reference

        comprobante_urls = evidence_urls + ([cert_url] if cert_url else [])
        comprobante_refs = evidence_refs + ([cert_ref] if cert_ref else [])

        rows.append({
            "becario_id": str(creator.id) if creator else "",
            "becario_email": creator.email if creator else "",
            "becario_nombre": creator.name if creator else "",
            "becario_telefono": creator.phone if creator else "",
            "becario_auth_source": creator.auth_source if creator else "",
            "actividad_id": str(a.id),
            "titulo": a.title,
            "tipo": _type_label(a),
            "zona": a.zone,
            "direccion": a.raw_address,
            "fecha_inicio": a.date_time.isoformat() if a.date_time else "",
            "fecha_fin": a.end_time.isoformat() if a.end_time else "",
            "descripcion": a.description or "",
            "horas_realizadas": a.realized_hours if a.realized_hours is not None else "",
            "horas_asignadas_externas": a.external_assigned_hours if a.external_assigned_hours is not None else "",
            "duracion_estimada_min": a.estimated_duration_min if a.estimated_duration_min is not None else "",
            "estado": a.status,
            "estado_label": _STATUS_LABELS.get(a.status, a.status),
            "validated_at": a.validated_at.isoformat() if a.validated_at else "",
            "validation_notes": a.validation_notes or "",
            "n_evidencias": len(evidence_rows),
            "tiene_certificado": "Sí" if cert_ref else "No",
            "enlaces_comprobantes": " ; ".join(comprobante_urls),
            "referencias_archivo": " ; ".join(comprobante_refs),
        })

    # --- Excel ---
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Reporte Becarios"
    headers = list(rows[0].keys()) if rows else [
        "becario_id", "becario_email", "becario_nombre", "becario_telefono",
        "becario_auth_source", "actividad_id", "titulo", "tipo", "zona",
        "direccion", "fecha_inicio", "fecha_fin", "descripcion",
        "horas_realizadas", "horas_asignadas_externas", "duracion_estimada_min",
        "estado", "estado_label", "validated_at", "validation_notes",
        "n_evidencias", "tiene_certificado", "enlaces_comprobantes",
        "referencias_archivo",
    ]
    ws.append(headers)
    for r in rows:
        ws.append([r.get(h, "") for h in headers])
    # Ancho de columnas razonable para legibilidad.
    for col_idx in range(1, len(headers) + 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = 22

    xlsx_buf = io.BytesIO()
    wb.save(xlsx_buf)
    xlsx_buf.seek(0)

    # --- ZIP (solo el reporte xlsx; los comprobantes se enlazan por URL) ---
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("reporte_becarios.xlsx", xlsx_buf.getvalue())

    zip_buf.seek(0)
    date_str = datetime.now(UTC).strftime("%Y-%m-%d")
    return StreamingResponse(
        iter([zip_buf.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="sismo_reporte_{date_str}.zip"'},
    )
