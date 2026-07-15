"""Activity CRUD endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID, uuid4

from dateutil.parser import parse as parse_dt
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.core.utils import ensure_timezone
from app.db.base import get_db
from app.db.constants import MVP_TENANT_ID
from app.db.enums import ActivityStatus, UserRole
from app.db.models import Activity, ActivityMember, ActivityEvidence, Notification, User
from app.pipeline.dependencies import require_session

router = APIRouter(prefix="/activities", tags=["activities"])
_log = get_logger("app.api.v1.activities")


def _serialize_activity(
    a: Activity,
    member_count: int = 0,
    creator: User | None = None,
    my_attended: bool | None = None,
) -> dict:
    result = {
        "id": str(a.id),
        "title": a.title,
        "description": a.description,
        "zone": a.zone,
        "raw_address": a.raw_address,
        "date_time": a.date_time.isoformat() if a.date_time else None,
        "end_time": a.end_time.isoformat() if a.end_time else None,
        "estimated_duration_min": a.estimated_duration_min,
        "max_participants": a.max_participants,
        "requirements": a.requirements,
        "contact_info": a.contact_info,
        "is_external_official": bool(a.external_beneficiary),
        "is_internal": bool(a.is_internal),
        "creator_id": str(a.creator_id),
        "status": a.status,
        "member_count": member_count,
        "my_attended": my_attended,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
    if creator:
        # The activity creator's phone is public on the activity itself
        # (auto-exposed when they publish), so volunteers can reach them.
        # It is NOT exposed anywhere else (directory / manual contacts).
        result["creator"] = {
            "id": str(creator.id),
            "name": creator.name,
            "photo_url": creator.photo_url,
            "phone": creator.phone,
        }
    return result


def _serialize_activities_batch(
    activities: list[Activity], db: Session, user_id: UUID | None = None
) -> list[dict]:
    if not activities:
        return []

    activity_ids = [a.id for a in activities]
    creator_ids = {a.creator_id for a in activities}

    count_rows = db.execute(
        select(ActivityMember.activity_id, func.count())
        .select_from(ActivityMember)
        .where(ActivityMember.activity_id.in_(activity_ids), ActivityMember.status == "active")
        .group_by(ActivityMember.activity_id)
    ).all()
    member_counts = {row[0]: row[1] for row in count_rows}

    attendance_map: dict[UUID, bool] = {}
    if user_id is not None:
        att_rows = db.execute(
            select(ActivityMember.activity_id, ActivityMember.attended)
            .where(
                ActivityMember.activity_id.in_(activity_ids),
                ActivityMember.user_id == user_id,
            )
        ).all()
        attendance_map = {row[0]: row[1] for row in att_rows}

    creators = db.execute(
        select(User).where(User.id.in_(creator_ids))
    ).scalars().all()
    creator_map = {c.id: c for c in creators}

    return [
        _serialize_activity(
            a,
            member_count=member_counts.get(a.id, 0),
            creator=creator_map.get(a.creator_id),
            my_attended=attendance_map.get(a.id),
        )
        for a in activities
    ]


# -- Public endpoints ----------------------------------------------


def _enrolled_activity_ids_subquery(user_id: UUID):
    """Subquery of activity ids where `user_id` is an active member, used to
    hide already-joined activities from discovery surfaces."""
    return select(ActivityMember.activity_id).where(
        ActivityMember.user_id == user_id,
        ActivityMember.status == "active",
    )


@router.get("")
def list_activities(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
    zone: str | None = None,
    status: str | None = "active",
) -> list[dict]:
    q = select(Activity)
    if zone:
        q = q.where(Activity.zone == zone)
    if status:
        q = q.where(Activity.status == status)
    # Ocultar actividades cuya fecha de inicio ya paso: el feed de descubrimiento
    # solo debe mostrar actividades futuras. Siguen accesibles por enlace directo
    # (GET /activities/{id}) y desde el perfil del organizador (GET /activities/mine).
    q = q.where(Activity.date_time >= datetime.now(UTC))
    # The discovery feed shows activities published by *others*; the user's own
    # creations live under "Mis actividades" (Creadas), not here.
    q = q.where(Activity.creator_id != user.id)
    # Also hide activities the user has already joined: discovery is for finding
    # new activities to enroll in, not ones they're already part of.
    q = q.where(Activity.id.notin_(_enrolled_activity_ids_subquery(user.id)))
    q = q.order_by(Activity.date_time.desc())
    activities = db.execute(q).scalars().all()
    return _serialize_activities_batch(activities, db, user_id=user.id)


@router.get("/zones")
def list_zones(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    # Counts must mirror the discovery feed (GET /activities): exclude the
    # user's own activities and the activities they've already joined, so the
    # filter tags don't advertise counts the list itself hides. Tambien se
    # excluyen las actividades cuya fecha de inicio ya paso.
    rows = db.execute(
        select(Activity.zone, func.count())
        .where(Activity.status == ActivityStatus.active.value)
        .where(Activity.date_time >= datetime.now(UTC))
        .where(Activity.creator_id != user.id)
        .where(Activity.id.notin_(_enrolled_activity_ids_subquery(user.id)))
        .group_by(Activity.zone)
    ).all()
    return [{"name": r[0], "count": r[1]} for r in rows]


# -- My activities (creator dashboard) --------------------------------


@router.get("/mine")
def my_activities(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    q = select(Activity).where(Activity.creator_id == user.id).order_by(Activity.created_at.desc())
    activities = db.execute(q).scalars().all()
    return _serialize_activities_batch(activities, db, user_id=user.id)


# -- Notifications -----------------------------------------------------


@router.get("/enrolled")
def enrolled_activities(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    q = (
        select(Activity)
        .join(ActivityMember, ActivityMember.activity_id == Activity.id)
        .where(ActivityMember.user_id == user.id, ActivityMember.status == "active")
        .order_by(Activity.date_time.desc())
    )
    activities = db.execute(q).scalars().all()
    return _serialize_activities_batch(activities, db, user_id=user.id)


def _prune_notifications(db: Session, user_id: UUID) -> None:
    """Retention policy: drop read notifications older than 30 days so the
    table does not grow unbounded as volume increases."""
    cutoff = datetime.now(UTC) - timedelta(days=30)
    db.execute(
        delete(Notification).where(
            Notification.user_id == user_id,
            Notification.read.is_(True),
            Notification.created_at < cutoff,
        )
    )
    db.commit()


@router.get("/notifications/summary")
def notifications_summary(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    unread = db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read.is_(False))
    ).scalar() or 0
    return {"unread": unread}


@router.get("/notifications")
def list_notifications(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
) -> list[dict]:
    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    # Cheap, side-effecting retention sweep keyed to the owner.
    _prune_notifications(db, user.id)

    q = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        q = q.where(Notification.read.is_(False))
    q = q.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    notifs = db.execute(q).scalars().all()
    return [
        {
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "activity_id": str(n.activity_id) if n.activity_id else None,
            "read": n.read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    n = db.get(Notification, UUID(notification_id))
    if not n or str(n.user_id) != str(user.id):
        raise ApiError(ErrorCode.not_found, "notification not found")
    n.read = True
    db.commit()
    return {"ok": True}


@router.get("/{activity_id}")
def get_activity(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    count = db.execute(
        select(func.count()).select_from(ActivityMember).where(ActivityMember.activity_id == a.id, ActivityMember.status == "active")
    ).scalar() or 0
    creator = db.get(User, a.creator_id)
    member = db.execute(
        select(ActivityMember.attended).where(
            ActivityMember.activity_id == a.id,
            ActivityMember.user_id == user.id,
            ActivityMember.status == "active",
        )
    ).first()
    my_attended = member[0] if member else None
    result = _serialize_activity(
        a, member_count=count, creator=creator, my_attended=my_attended
    )
    has_attendance = (
        db.execute(
            select(func.count()).select_from(ActivityMember).where(
                ActivityMember.activity_id == a.id,
                ActivityMember.attended.isnot(None),
            )
        ).scalar()
        or 0
    ) > 0
    result["has_attendance"] = has_attendance
    result["external_certificate"] = a.external_certificate
    return result


@router.get("/{activity_id}/membership")
def check_membership(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    member = db.execute(
        select(ActivityMember).where(
            ActivityMember.activity_id == a.id,
            ActivityMember.user_id == user.id,
            ActivityMember.status == "active",
        )
    ).scalar_one_or_none()
    return {"is_member": member is not None}


# -- Authenticated endpoints ---------------------------------------


class _CreateActivityBody(BaseModel):
    # Whitelist of client-supplied fields. `creator_id`, `tenant_id`,
    # `status` are NEVER taken from the body — they are derived server-side
    # from the authenticated session. `description`, `requirements` and
    # `contact_info` are free text rendered in React (auto-escaped) and are
    # length-capped to bound storage. Numeric fields are range-checked.
    title: str = Field(..., min_length=1, max_length=200)
    zone: str = Field(..., min_length=1, max_length=100)
    raw_address: str = Field(..., min_length=1, max_length=300)
    date_time: str = Field(..., description="ISO 8601 datetime")
    end_time: str | None = Field(None, description="ISO 8601 datetime")
    description: str | None = Field(None, max_length=2000)
    requirements: str | None = Field(None, max_length=1000)
    contact_info: str | None = Field(None, max_length=500)
    max_participants: int | None = Field(None, ge=1, le=100000)
    estimated_duration_min: int | None = Field(None, ge=1, le=100000)
    external_beneficiary: str | None = Field(None, max_length=255)
    external_supervisor: str | None = Field(None, max_length=255)
    external_supervisor_email: str | None = Field(None, max_length=255)
    external_assigned_hours: float | None = Field(None, ge=0, le=100000)
    # Voluntariado interno: suma horas al programa. Excluyente con externo oficial.
    is_internal: bool = Field(False)


@router.post("")
def create_activity(
    body: _CreateActivityBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    # Public (non-SEP) accounts may only join activities, not create them.
    # SEP-provisioned users and SISMO admins retain full access.
    if user.auth_source != "sep" and user.role != UserRole.admin.value:
        raise ApiError(
            ErrorCode.auth_forbidden,
            "las cuentas publicas no pueden crear actividades",
        )

    title = body.title.strip()
    if not title:
        raise ApiError(ErrorCode.validation_missing_field, "title is required")
    zone = body.zone.strip()
    if not zone:
        raise ApiError(ErrorCode.validation_missing_field, "zone is required")
    raw_address = body.raw_address.strip()
    if not raw_address:
        raise ApiError(ErrorCode.validation_missing_field, "raw_address is required")

    try:
        date_time = ensure_timezone(parse_dt(body.date_time))
    except (ValueError, TypeError):
        raise ApiError(ErrorCode.validation_invalid_format, "invalid date_time format")

    end_time = None
    if body.end_time:
        try:
            end_time = ensure_timezone(parse_dt(body.end_time))
        except (ValueError, TypeError):
            pass

    # Voluntariado interno y externo oficial son excluyentes: si se marca interno,
    # se descartan los datos de externo oficial.
    # TODO (control por rol): de momento cualquier usuario con permiso de crear
    # puede marcar `is_internal`. Si en el futuro solo coordinadores/staff/becarios
    # de AVAA deben poder crearlo, validar aqui el rol del usuario, p.ej.:
    #   if body.is_internal and user.role not in {UserRole.admin.value, "coordinator", "staff"}:
    #       raise ApiError(ErrorCode.auth_forbidden, "solo coordinadores/staff pueden crear voluntariado interno")
    is_internal = bool(body.is_internal)

    a = Activity(
        title=title,
        description=body.description,
        zone=zone,
        raw_address=raw_address,
        date_time=date_time,
        end_time=end_time,
        estimated_duration_min=body.estimated_duration_min,
        max_participants=body.max_participants,
        requirements=body.requirements,
        contact_info=body.contact_info,
        external_beneficiary=None if is_internal else body.external_beneficiary,
        external_supervisor=None if is_internal else body.external_supervisor,
        external_supervisor_email=None if is_internal else body.external_supervisor_email,
        external_assigned_hours=None if is_internal else body.external_assigned_hours,
        is_internal=is_internal,
        creator_id=user.id,
        status=ActivityStatus.active.value,
    )
    a.tenant_id = MVP_TENANT_ID
    db.add(a)
    db.commit()
    db.refresh(a)
    _log.info("activity.created", activity_id=str(a.id), creator_id=str(user.id))
    return _serialize_activity(a)


@router.patch("/{activity_id}")
def update_activity(
    activity_id: str,
    body: _UpdateActivityBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    if str(a.creator_id) != str(user.id):
        raise ApiError(ErrorCode.activity_not_creator, "solo el creador puede editar")

    _apply_text_fields(a, body)
    _apply_datetime_fields(a, body)
    _apply_numeric_fields(a, body)

    # Voluntariado interno y externo oficial son excluyentes.
    # TODO (control por rol): ver create_activity; si se restringe por rol,
    # validar aqui tambien antes de permitir marcar `is_internal`.
    if body.is_internal is not None:
        a.is_internal = bool(body.is_internal)
        if a.is_internal:
            a.external_beneficiary = None
            a.external_supervisor = None
            a.external_supervisor_email = None
            a.external_assigned_hours = None

    db.commit()
    db.refresh(a)
    creator = db.get(User, a.creator_id)
    return _serialize_activity(a, creator=creator)


@router.delete("/{activity_id}")
def cancel_activity(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
    body: dict | None = None,
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    if str(a.creator_id) != str(user.id):
        raise ApiError(ErrorCode.activity_not_creator, "solo el creador puede cancelar")

    archive = False
    if body and body.get("archive"):
        archive = True

    a.status = ActivityStatus.archived.value if archive else ActivityStatus.cancelled.value

    # Notify all attendees
    members = db.execute(
        select(ActivityMember).where(ActivityMember.activity_id == a.id, ActivityMember.status == "active")
    ).scalars().all()

    status_label = "realizada" if archive else "cancelada"
    for m in members:
        # Skip the creator: they are the one cancelling/archiving
        if str(m.user_id) == str(a.creator_id):
            continue
        n = Notification(
            user_id=m.user_id,
            activity_id=a.id,
            type="activity_cancelled",
            title=f"Actividad {status_label}: {a.title}",
            message=f"La actividad '{a.title}' ha sido {status_label} por el organizador.",
        )
        n.tenant_id = MVP_TENANT_ID
        db.add(n)

    db.commit()
    return {"ok": True, "status": a.status}


@router.post("/{activity_id}/join")
def join_activity(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    if a.status != ActivityStatus.active.value:
        raise ApiError(ErrorCode.activity_cancelled, "activity is cancelled")

    existing = db.execute(
        select(ActivityMember).where(ActivityMember.activity_id == a.id, ActivityMember.user_id == user.id)
    ).scalar_one_or_none()
    if existing:
        if existing.status == "active":
            raise ApiError(ErrorCode.activity_already_joined, "ya estás inscrito")
        # Reactivar una cesión previa del mismo becario
        existing.status = "active"
        existing.attended = None
        existing.ceded_at = None
        db.commit()
        _log.info("activity.rejoined", activity_id=str(a.id), user_id=str(user.id))
        return {"ok": True}

    # Overbooking check: atomic insert with count check
    result = db.execute(
        text("""
            INSERT INTO activity_members (id, activity_id, user_id, attended, created_at, updated_at)
            SELECT :id, :activity_id, :user_id, NULL, NOW(), NOW()
            WHERE (
                SELECT COUNT(*) FROM activity_members WHERE activity_id = :activity_id
            ) < (
                SELECT COALESCE(max_participants, 999999) FROM activities WHERE id = :activity_id
            )
        """),
        {"id": str(uuid4()), "activity_id": str(a.id), "user_id": str(user.id)},
    )
    if result.rowcount == 0:
        raise ApiError(ErrorCode.activity_full, "cupos agotados")

    # Notify the host (creator) about the new enrollment
    if str(a.creator_id) != str(user.id):
        n = Notification(
            user_id=a.creator_id,
            activity_id=a.id,
            type="new_enrollment",
            title=f"Nueva inscripcion en {a.title}",
            message=f"{user.name or user.email} se ha inscrito en tu actividad '{a.title}'.",
        )
        n.tenant_id = MVP_TENANT_ID
        db.add(n)

    db.commit()
    _log.info("activity.joined", activity_id=str(a.id), user_id=str(user.id))
    return {"ok": True}


@router.post("/{activity_id}/leave")
def leave_activity(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")

    member = db.execute(
        select(ActivityMember).where(ActivityMember.activity_id == a.id, ActivityMember.user_id == user.id)
    ).scalar_one_or_none()
    if not member:
        raise ApiError(ErrorCode.activity_not_member, "no estás inscrito")

    db.delete(member)
    db.commit()
    return {"ok": True}


class _TransferBody(BaseModel):
    to_user_id: str


@router.post("/{activity_id}/transfer")
def transfer_membership(
    activity_id: str,
    body: _TransferBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    try:
        to_uuid = UUID(body.to_user_id)
    except ValueError:
        raise ApiError(ErrorCode.validation_invalid, "user_id inválido")

    to_user = db.get(User, to_uuid)
    if not to_user:
        raise ApiError(ErrorCode.user_not_found, "usuario no encontrado")
    if str(to_user.id) == str(user.id):
                raise ApiError(ErrorCode.validation_invalid_format, "no puedes cederte el cupo a ti mismo")

    # Ceder cupo rules:
    #  - SEP users and admins can cede to anyone.
    #  - External (Google) users can only cede to other external users.
    #  - Anyone may *receive* a cupo (including from SEP users).
    can_cede_to_anyone = (
        user.role == UserRole.admin.value
        or user.auth_source == "sep"
    )
    if not can_cede_to_anyone and to_user.auth_source != "google":
        raise ApiError(
            ErrorCode.auth_forbidden,
            "solo puedes ceder cupo a otros usuarios externos",
        )

    src = db.execute(
        select(ActivityMember).where(
            ActivityMember.activity_id == a.id,
            ActivityMember.user_id == user.id,
            ActivityMember.status == "active",
        )
    ).scalar_one_or_none()
    if not src:
        raise ApiError(ErrorCode.activity_not_member, "no estás inscrito activamente")

    existing = db.execute(
        select(ActivityMember).where(
            ActivityMember.activity_id == a.id,
            ActivityMember.user_id == to_user.id,
            ActivityMember.status == "active",
        )
    ).scalar_one_or_none()
    if existing:
        raise ApiError(ErrorCode.activity_already_joined, "ese becario ya está inscrito")

    src.status = "ceded"
    src.ceded_at = datetime.now(UTC)
    db.add(ActivityMember(activity_id=a.id, user_id=to_user.id, status="active", attended=None))

    n = Notification(
        user_id=to_user.id,
        activity_id=a.id,
        type="activity_transferred",
        title=f"Te cedieron un cupo en {a.title}",
        message=f"{user.name or user.email} te cedió su cupo en la actividad '{a.title}'.",
    )
    n.tenant_id = MVP_TENANT_ID
    db.add(n)

    db.commit()
    _log.info("activity.transferred", activity_id=str(a.id), from_user=str(user.id), to_user=str(to_user.id))
    return {"ok": True}


@router.get("/{activity_id}/attendees")
def list_attendees(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")

    # The creator must be able to see their own attendees to administer the
    # activity. Other external (public) accounts cannot browse attendees, to
    # protect PII; SEP users and SISMO admins may.
    is_creator = str(a.creator_id) == str(user.id)
    if (
        not is_creator
        and user.auth_source != "sep"
        and user.role != UserRole.admin.value
    ):
        raise ApiError(
            ErrorCode.auth_forbidden,
            "no tienes permiso para ver los inscritos de esta actividad",
        )

    members = db.execute(
        select(ActivityMember, User)
        .join(User, ActivityMember.user_id == User.id)
        .where(ActivityMember.activity_id == a.id)
    ).all()
    return [
        {
            "user_id": str(m.user_id),
            "name": u.name or u.email,
            "email": u.email if is_creator else None,
            "photo_url": u.photo_url,
            "attended": m.attended,
            "status": m.status,
            "joined_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m, u in members
    ]


class _AttendeeAction(BaseModel):
    attended: bool


class _UpdateActivityBody(BaseModel):
    title: str | None = None
    description: str | None = None
    zone: str | None = None
    raw_address: str | None = None
    requirements: str | None = None
    date_time: str | None = None
    end_time: str | None = None
    max_participants: int | None = None
    estimated_duration_min: int | None = None
    contact_info: str | None = None
    external_beneficiary: str | None = None
    external_supervisor: str | None = None
    external_supervisor_email: str | None = None
    external_assigned_hours: float | None = None
    is_internal: bool | None = None


def _apply_text_fields(a: Activity, body: _UpdateActivityBody) -> None:
    for field in (
        "title",
        "description",
        "zone",
        "raw_address",
        "requirements",
        "external_beneficiary",
        "external_supervisor",
        "external_supervisor_email",
    ):
        val = getattr(body, field)
        if val is not None:
            setattr(a, field, val)


def _apply_datetime_fields(a: Activity, body: _UpdateActivityBody) -> None:
    if body.date_time is not None:
        try:
            a.date_time = ensure_timezone(parse_dt(body.date_time))
        except (ValueError, TypeError):
            raise ApiError(ErrorCode.validation_invalid_format, "invalid date_time format")
    if body.end_time is not None:
        if body.end_time:
            try:
                a.end_time = ensure_timezone(parse_dt(body.end_time))
            except (ValueError, TypeError):
                pass
        else:
            a.end_time = None


def _apply_numeric_fields(a: Activity, body: _UpdateActivityBody) -> None:
    if body.max_participants is not None:
        a.max_participants = body.max_participants
    if body.estimated_duration_min is not None:
        a.estimated_duration_min = body.estimated_duration_min
    if body.contact_info is not None:
        a.contact_info = body.contact_info
    if body.external_assigned_hours is not None:
        a.external_assigned_hours = body.external_assigned_hours


@router.post("/{activity_id}/attendees/{target_user_id}/attended")
def mark_attendance(
    activity_id: str,
    target_user_id: str,
    body: _AttendeeAction,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    if str(a.creator_id) != str(user.id):
        raise ApiError(ErrorCode.activity_not_creator, "solo el creador puede marcar asistencia")

    member = db.execute(
        select(ActivityMember).where(
            ActivityMember.activity_id == a.id,
            ActivityMember.user_id == UUID(target_user_id),
        )
    ).scalar_one_or_none()
    if not member:
        raise ApiError(ErrorCode.activity_not_member, "user not in activity")

    member.attended = body.attended
    db.commit()
    return {"ok": True}


class _ExternalCertificateBody(BaseModel):
    certificate: str | None = None


_MAX_CERTIFICATE_LEN = 8 * 1024 * 1024  # ~6MB PDF en base64


def _require_external_official_ready(
    a: Activity, user: User, db: Session
) -> None:
    """Valida que el creador pueda gestionar la constancia de un voluntariado
    oficial externo: debe ser el creador, ser externo oficial, estar 'Realizada'
    (archived) y tener al menos una asistencia marcada."""
    if str(a.creator_id) != str(user.id):
        raise ApiError(ErrorCode.activity_not_creator, "solo el creador puede gestionar la constancia")
    if not a.external_beneficiary:
        raise ApiError(ErrorCode.validation_invalid, "la actividad no es un voluntariado oficial externo")
    if a.status != ActivityStatus.archived.value:
        raise ApiError(ErrorCode.validation_invalid, "la actividad debe estar marcada como realizada")
    has_attendance = (
        db.execute(
            select(func.count()).select_from(ActivityMember).where(
                ActivityMember.activity_id == a.id,
                ActivityMember.attended.isnot(None),
            )
        ).scalar()
        or 0
    ) > 0
    if not has_attendance:
        raise ApiError(ErrorCode.validation_invalid, "debes marcar la asistencia antes de subir la constancia")


@router.post("/{activity_id}/external-certificate")
def upload_external_certificate(
    activity_id: str,
    body: _ExternalCertificateBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    _require_external_official_ready(a, user, db)

    cert = body.certificate
    if not cert or not cert.startswith("data:application/pdf;base64,"):
        raise ApiError(
            ErrorCode.validation_invalid_format,
            "la constancia debe ser un archivo PDF (data:application/pdf;base64,)",
        )
    if len(cert) > _MAX_CERTIFICATE_LEN:
        raise ApiError(ErrorCode.validation_invalid_format, "la constancia PDF es demasiado grande")

    a.external_certificate = cert
    db.commit()
    _log.info("activity.external_certificate.uploaded", activity_id=str(a.id), creator_id=str(user.id))
    return {"ok": True, "external_certificate": a.external_certificate}


@router.delete("/{activity_id}/external-certificate")
def delete_external_certificate(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    _require_external_official_ready(a, user, db)

    a.external_certificate = None
    db.commit()
    _log.info("activity.external_certificate.deleted", activity_id=str(a.id), creator_id=str(user.id))
    return {"ok": True}


# -- Comprobantes fotograficos (evidencia) -------------------------------


_MAX_EVIDENCE_IMAGES = 10
_MAX_EVIDENCE_IMAGE_BYTES = 5 * 1024 * 1024  # ~3.7MB imagen cruda -> base64


def _serialize_evidence(ev: ActivityEvidence, uploader_name: str | None) -> dict:
    return {
        "id": str(ev.id),
        "image_url": ev.image_url,
        "uploaded_by": str(ev.uploaded_by),
        "uploader_name": uploader_name,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }


def _activity_has_started(a: Activity) -> bool:
    return a.date_time is not None and a.date_time <= datetime.now(UTC)


def _activity_is_closed(a: Activity) -> bool:
    # Una actividad se considera cerrada cuando deja de estar activa
    # (realizada/archivada o cancelada). Mientras este activa, incluso si su
    # fecha fin ya paso, el organizador aun puede aportar/quitar comprobantes
    # hasta confirmar su realizacion.
    return a.status != ActivityStatus.active.value


def _require_evidence_management(a: Activity, user: User) -> None:
    """Solo el creador puede gestionar comprobantes, y unicamente mientras la
    actividad haya iniciado y no este cerrada (archivada/cancelada)."""
    if str(a.creator_id) != str(user.id):
        raise ApiError(
            ErrorCode.activity_not_creator,
            "solo el creador puede gestionar los comprobantes",
        )
    if not _activity_has_started(a):
        raise ApiError(
            ErrorCode.validation_invalid,
            "solo puedes subir comprobantes una vez iniciada la actividad",
        )
    if _activity_is_closed(a):
        raise ApiError(ErrorCode.validation_invalid, "la actividad ya esta cerrada")


@router.get("/{activity_id}/evidence")
def list_evidence(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    rows = db.execute(
        select(ActivityEvidence, User.name)
        .join(User, ActivityEvidence.uploaded_by == User.id)
        .where(ActivityEvidence.activity_id == a.id)
        .order_by(ActivityEvidence.created_at.asc())
    ).all()
    return [
        _serialize_evidence(ev, name)
        for ev, name in rows
    ]


class _EvidenceUploadBody(BaseModel):
    # Acepta varias imagenes a la vez (data URLs) para subir comprobantes en
    # lote. Cada imagen se valida como data:image/ y se acota su tamano.
    images: list[str] = Field(..., min_length=1, max_length=_MAX_EVIDENCE_IMAGES)


@router.post("/{activity_id}/evidence")
def upload_evidence(
    activity_id: str,
    body: _EvidenceUploadBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    _require_evidence_management(a, user)

    # Validar todas las imagenes antes de escribir nada.
    for img in body.images:
        if not isinstance(img, str) or not img.startswith("data:image/"):
            raise ApiError(
                ErrorCode.validation_invalid_format,
                "cada comprobante debe ser una imagen (data:image/...)",
            )
        if len(img) > _MAX_EVIDENCE_IMAGE_BYTES:
            raise ApiError(
                ErrorCode.validation_invalid_format,
                "una de las imagenes es demasiado grande",
            )

    created: list[ActivityEvidence] = []
    for img in body.images:
        ev = ActivityEvidence(
            activity_id=a.id,
            uploaded_by=user.id,
            image_url=img,
        )
        ev.tenant_id = MVP_TENANT_ID
        db.add(ev)
        created.append(ev)
    db.commit()
    for ev in created:
        db.refresh(ev)
    _log.info(
        "activity.evidence.uploaded",
        activity_id=str(a.id),
        creator_id=str(user.id),
        count=len(created),
    )
    uploader_name = user.name
    return {"items": [_serialize_evidence(ev, uploader_name) for ev in created]}


@router.delete("/{activity_id}/evidence/{evidence_id}")
def delete_evidence(
    activity_id: str,
    evidence_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    _require_evidence_management(a, user)

    ev = db.get(ActivityEvidence, UUID(evidence_id))
    if not ev or str(ev.activity_id) != str(a.id):
        raise ApiError(ErrorCode.not_found, "comprobante no encontrado")

    db.delete(ev)
    db.commit()
    _log.info(
        "activity.evidence.deleted",
        activity_id=str(a.id),
        evidence_id=str(ev.id),
        creator_id=str(user.id),
    )
    return {"ok": True}


class _ExpandBody(BaseModel):
    additional: int = 5


@router.post("/{activity_id}/expand")
def expand_capacity(
    activity_id: str,
    body: _ExpandBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    if str(a.creator_id) != str(user.id):
        raise ApiError(ErrorCode.activity_not_creator, "solo el creador puede ampliar cupos")

    a.max_participants = (a.max_participants or 0) + body.additional
    db.commit()
    return {"ok": True, "max_participants": a.max_participants}
