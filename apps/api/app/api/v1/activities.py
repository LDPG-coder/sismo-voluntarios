"""Activity CRUD endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID, uuid4

from dateutil.parser import parse as parse_dt
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.core.utils import ensure_timezone
from app.db.base import get_db
from app.db.constants import MVP_TENANT_ID
from app.db.enums import ActivityStatus
from app.db.models import Activity, ActivityMember, Notification, User
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
        "creator_id": str(a.creator_id),
        "status": a.status,
        "member_count": member_count,
        "my_attended": my_attended,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }
    if creator:
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
    q = q.order_by(Activity.date_time.desc())
    activities = db.execute(q).scalars().all()
    return _serialize_activities_batch(activities, db, user_id=user.id)


@router.get("/zones")
def list_zones(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    rows = db.execute(
        select(Activity.zone, func.count()).where(Activity.status == ActivityStatus.active.value).group_by(Activity.zone)
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
    return _serialize_activity(
        a, member_count=count, creator=creator, my_attended=my_attended
    )


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


@router.post("")
def create_activity(
    body: dict,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    title = str(body.get("title", "")).strip()
    if not title:
        raise ApiError(ErrorCode.validation_missing_field, "title is required")
    zone = str(body.get("zone", "")).strip()
    if not zone:
        raise ApiError(ErrorCode.validation_missing_field, "zone is required")
    raw_address = str(body.get("raw_address", "")).strip()
    if not raw_address:
        raise ApiError(ErrorCode.validation_missing_field, "raw_address is required")
    date_time_str = body.get("date_time")
    if not date_time_str:
        raise ApiError(ErrorCode.validation_missing_field, "date_time is required")

    try:
        date_time = ensure_timezone(parse_dt(date_time_str))
    except (ValueError, TypeError):
        raise ApiError(ErrorCode.validation_invalid_format, "invalid date_time format")

    end_time = None
    end_time_str = body.get("end_time")
    if end_time_str:
        try:
            end_time = ensure_timezone(parse_dt(end_time_str))
        except (ValueError, TypeError):
            pass

    a = Activity(
        title=title,
        description=body.get("description"),
        zone=zone,
        raw_address=raw_address,
        date_time=date_time,
        end_time=end_time,
        estimated_duration_min=body.get("estimated_duration_min"),
        max_participants=body.get("max_participants"),
        requirements=body.get("requirements"),
        contact_info=body.get("contact_info"),
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
        raise ApiError(ErrorCode.validation_invalid, "no puedes cederte el cupo a ti mismo")

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

    is_creator = str(a.creator_id) == str(user.id)

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


def _apply_text_fields(a: Activity, body: _UpdateActivityBody) -> None:
    for field in ("title", "description", "zone", "raw_address", "requirements"):
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
