"""Admin dashboard endpoints: stats overview and CSV export."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ErrorCode
from app.core.logging import get_logger
from app.db.base import get_db
from app.db.enums import ActivityStatus, UserRole
from app.db.models.activities import Activity
from app.db.models.activity_evidence import ActivityEvidence
from app.db.models.activity_members import ActivityMember
from app.db.models.identity import User
from app.pipeline.dependencies import require_admin_session

_log = get_logger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    total_users: int
    total_activities: int
    active_activities: int
    completed_activities: int
    total_members: int
    pending_validation: int
    total_evidence: int
    recent_activities: list[dict]
    recent_users: list[dict]


def _user_summary(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "name": u.name,
        "photo_url": u.photo_url,
        "role": u.role,
        "status": u.status,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _activity_summary(a: Activity, member_count: int = 0) -> dict:
    type_label = "ProExcelencia"
    if a.is_internal:
        type_label = "Interno"
    elif a.external_beneficiary:
        type_label = "Oficial"
    elif a.is_private:
        type_label = "Registro previo"
    return {
        "id": str(a.id),
        "title": a.title,
        "zone": a.zone,
        "date_time": a.date_time.isoformat() if a.date_time else None,
        "status": a.status,
        "type": type_label,
        "member_count": member_count,
        "creator_id": str(a.creator_id),
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(
    admin: Annotated[User, Depends(require_admin_session)],
    db: Annotated[Session, Depends(get_db)],
) -> DashboardStats:
    """Resumen ejecutivo para el panel de admin."""
    total_users = db.execute(select(func.count(User.id))).scalar() or 0
    total_activities = db.execute(select(func.count(Activity.id))).scalar() or 0
    active_activities = db.execute(
        select(func.count(Activity.id)).where(Activity.status == ActivityStatus.active.value)
    ).scalar() or 0
    completed_activities = db.execute(
        select(func.count(Activity.id)).where(Activity.status == ActivityStatus.archived.value)
    ).scalar() or 0
    total_members = db.execute(select(func.count(ActivityMember.id))).scalar() or 0
    pending_validation = db.execute(
        select(func.count(Activity.id)).where(
            Activity.status == ActivityStatus.pending_validation.value
        )
    ).scalar() or 0
    total_evidence = db.execute(select(func.count(ActivityEvidence.id))).scalar() or 0

    # Recent activities (last 10)
    recent_q = (
        select(Activity)
        .order_by(Activity.created_at.desc())
        .limit(10)
    )
    recent_activities_raw = db.execute(recent_q).scalars().all()
    recent_activities = []
    for a in recent_activities_raw:
        mc = db.execute(
            select(func.count(ActivityMember.id)).where(ActivityMember.activity_id == a.id)
        ).scalar() or 0
        recent_activities.append(_activity_summary(a, mc))

    # Recent users (last 10)
    recent_users_q = select(User).order_by(User.created_at.desc()).limit(10)
    recent_users_raw = db.execute(recent_users_q).scalars().all()
    recent_users = [_user_summary(u) for u in recent_users_raw]

    return DashboardStats(
        total_users=total_users,
        total_activities=total_activities,
        active_activities=active_activities,
        completed_activities=completed_activities,
        total_members=total_members,
        pending_validation=pending_validation,
        total_evidence=total_evidence,
        recent_activities=recent_activities,
        recent_users=recent_users,
    )


# ---------------------------------------------------------------------------
# CSV Export
# ---------------------------------------------------------------------------

@router.get("/export-csv")
def export_all_csv(
    admin: Annotated[User, Depends(require_admin_session)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    """Exporta actividades, participantes y usuarios en un ZIP de archivos CSV."""
    buf = io.BytesIO()
    with __import__("zipfile").ZipFile(buf, "w", __import__("zipfile").ZIP_DEFLATED) as zf:
        # --- actividades.csv ---
        activities = db.execute(
            select(Activity).order_by(Activity.created_at.desc())
        ).scalars().all()
        act_rows = []
        for a in activities:
            type_label = "ProExcelencia"
            if a.is_internal:
                type_label = "Interno"
            elif a.external_beneficiary:
                type_label = "Oficial"
            elif a.is_private:
                type_label = "Registro previo"
            creator = db.get(User, a.creator_id)
            act_rows.append({
                "id": str(a.id),
                "titulo": a.title,
                "zona": a.zone,
                "direccion": a.raw_address,
                "fecha": a.date_time.isoformat() if a.date_time else "",
                "tipo": type_label,
                "estado": a.status,
                "creador": creator.email if creator else "",
                "participantes_max": a.max_participants or "",
                "horas_estimadas": a.estimated_duration_min or "",
                "fecha_creacion": a.created_at.isoformat() if a.created_at else "",
            })
        if act_rows:
            out = io.StringIO()
            w = csv.DictWriter(out, fieldnames=act_rows[0].keys())
            w.writeheader()
            w.writerows(act_rows)
            zf.writestr("actividades.csv", out.getvalue())

        # --- participantes.csv ---
        members = db.execute(select(ActivityMember)).scalars().all()
        member_rows = []
        for m in members:
            user = db.get(User, m.user_id)
            act = db.get(Activity, m.activity_id)
            member_rows.append({
                "actividad_id": str(m.activity_id),
                "actividad_titulo": act.title if act else "",
                "usuario_email": user.email if user else "",
                "usuario_nombre": user.name if user else "",
                "asistio": m.attended if m.attended is not None else "",
                "estado": m.status,
                "fecha_inscripcion": m.created_at.isoformat() if m.created_at else "",
            })
        if member_rows:
            out = io.StringIO()
            w = csv.DictWriter(out, fieldnames=member_rows[0].keys())
            w.writeheader()
            w.writerows(member_rows)
            zf.writestr("participantes.csv", out.getvalue())

        # --- usuarios.csv ---
        users = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
        user_rows = []
        for u in users:
            member_count = db.execute(
                select(func.count(ActivityMember.id)).where(ActivityMember.user_id == u.id)
            ).scalar() or 0
            created_count = db.execute(
                select(func.count(Activity.id)).where(Activity.creator_id == u.id)
            ).scalar() or 0
            user_rows.append({
                "id": str(u.id),
                "email": u.email,
                "nombre": u.name or "",
                "telefono": u.phone or "",
                "rol": u.role,
                "estado": u.status,
                "auth_source": u.auth_source,
                "actividades_creadas": created_count,
                "actividades_inscritas": member_count,
                "fecha_registro": u.created_at.isoformat() if u.created_at else "",
            })
        if user_rows:
            out = io.StringIO()
            w = csv.DictWriter(out, fieldnames=user_rows[0].keys())
            w.writeheader()
            w.writerows(user_rows)
            zf.writestr("usuarios.csv", out.getvalue())

    buf.seek(0)
    date_str = datetime.now(UTC).strftime("%Y-%m-%d")
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="sismo_export_{date_str}.zip"'},
    )
