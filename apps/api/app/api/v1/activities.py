"""Activity CRUD endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.db.base import get_db
from app.db.enums import ActivityStatus
from app.db.models import Activity, ActivityMember, Notification, User
from app.pipeline.dependencies import require_session

router = APIRouter(prefix="/activities", tags=["activities"])
_log = get_logger("app.api.v1.activities")


def _serialize_activity(a: Activity, member_count: int = 0, creator: User | None = None) -> dict:
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

    result = []
    for a in activities:
        count = db.execute(
            select(func.count()).select_from(ActivityMember).where(ActivityMember.activity_id == a.id)
        ).scalar() or 0
        creator = db.get(User, a.creator_id)
        result.append(_serialize_activity(a, member_count=count, creator=creator))
    return result


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

    result = []
    for a in activities:
        count = db.execute(
            select(func.count()).select_from(ActivityMember).where(ActivityMember.activity_id == a.id)
        ).scalar() or 0
        creator = db.get(User, a.creator_id)
        result.append(_serialize_activity(a, member_count=count, creator=creator))
    return result


# -- Notifications -----------------------------------------------------


@router.get("/enrolled")
def enrolled_activities(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    q = (
        select(Activity)
        .join(ActivityMember, ActivityMember.activity_id == Activity.id)
        .where(ActivityMember.user_id == user.id)
        .order_by(Activity.date_time.desc())
    )
    activities = db.execute(q).scalars().all()

    result = []
    for a in activities:
        count = db.execute(
            select(func.count()).select_from(ActivityMember).where(ActivityMember.activity_id == a.id)
        ).scalar() or 0
        creator = db.get(User, a.creator_id)
        result.append(_serialize_activity(a, member_count=count, creator=creator))
    return result


@router.get("/notifications")
def list_notifications(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    from app.db.models import Notification as NotificationModel
    notifs = db.execute(
        select(NotificationModel)
        .where(NotificationModel.user_id == user.id)
        .order_by(NotificationModel.created_at.desc())
        .limit(50)
    ).scalars().all()
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
    from uuid import UUID
    from app.db.models import Notification as NotificationModel
    n = db.get(NotificationModel, UUID(notification_id))
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
    from uuid import UUID
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    count = db.execute(
        select(func.count()).select_from(ActivityMember).where(ActivityMember.activity_id == a.id)
    ).scalar() or 0
    creator = db.get(User, a.creator_id)
    return _serialize_activity(a, member_count=count, creator=creator)


@router.get("/{activity_id}/membership")
def check_membership(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    from uuid import UUID
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    member = db.execute(
        select(ActivityMember).where(ActivityMember.activity_id == a.id, ActivityMember.user_id == user.id)
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

    from dateutil.parser import parse as parse_dt
    from datetime import timezone, timedelta
    try:
        date_time = parse_dt(date_time_str)
        if date_time.tzinfo is None:
            date_time = date_time.replace(tzinfo=timezone(timedelta(hours=-4)))
    except (ValueError, TypeError):
        raise ApiError(ErrorCode.validation_invalid_format, "invalid date_time format")

    end_time = None
    end_time_str = body.get("end_time")
    if end_time_str:
        try:
            end_time = parse_dt(end_time_str)
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone(timedelta(hours=-4)))
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
    from app.db.constants import MVP_TENANT_ID
    a.tenant_id = MVP_TENANT_ID
    db.add(a)
    db.commit()
    db.refresh(a)
    _log.info("activity.created", activity_id=str(a.id), creator_id=str(user.id))
    return _serialize_activity(a)


@router.patch("/{activity_id}")
def update_activity(
    activity_id: str,
    body: dict,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    from uuid import UUID
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    if str(a.creator_id) != str(user.id):
        raise ApiError(ErrorCode.activity_not_creator, "solo el creador puede editar")

    for field in ("title", "description", "zone", "raw_address", "requirements"):
        if field in body:
            setattr(a, field, body[field])
    if "date_time" in body:
        from dateutil.parser import parse as parse_dt
        from datetime import timezone, timedelta
        try:
            dt = parse_dt(body["date_time"])
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone(timedelta(hours=-4)))
            a.date_time = dt
        except (ValueError, TypeError):
            raise ApiError(ErrorCode.validation_invalid_format, "invalid date_time format")
    if "end_time" in body:
        from dateutil.parser import parse as parse_dt
        from datetime import timezone, timedelta
        end_val = body["end_time"]
        if end_val:
            try:
                et = parse_dt(end_val)
                if et.tzinfo is None:
                    et = et.replace(tzinfo=timezone(timedelta(hours=-4)))
                a.end_time = et
            except (ValueError, TypeError):
                pass
        else:
            a.end_time = None
    if "max_participants" in body:
        a.max_participants = body["max_participants"]

    db.commit()
    db.refresh(a)
    return _serialize_activity(a)


@router.delete("/{activity_id}")
def cancel_activity(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
    body: dict | None = None,
) -> dict:
    from uuid import UUID
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
        select(ActivityMember).where(ActivityMember.activity_id == a.id)
    ).scalars().all()

    status_label = "realizada" if archive else "cancelada"
    for m in members:
        n = Notification(
            user_id=m.user_id,
            activity_id=a.id,
            type="activity_cancelled",
            title=f"Actividad {status_label}: {a.title}",
            message=f"La actividad '{a.title}' ha sido {status_label} por el organizador.",
        )
        from app.db.constants import MVP_TENANT_ID
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
    from uuid import UUID
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    if a.status != ActivityStatus.active.value:
        raise ApiError(ErrorCode.activity_cancelled, "activity is cancelled")

    existing = db.execute(
        select(ActivityMember).where(ActivityMember.activity_id == a.id, ActivityMember.user_id == user.id)
    ).scalar_one_or_none()
    if existing:
        raise ApiError(ErrorCode.activity_already_joined, "ya estás inscrito")

    # Overbooking check: atomic insert with count check
    from sqlalchemy import text
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
        {"id": str(UUID()), "activity_id": str(a.id), "user_id": str(user.id)},
    )
    if result.rowcount == 0:
        raise ApiError(ErrorCode.activity_full, "cupos agotados")

    db.commit()
    _log.info("activity.joined", activity_id=str(a.id), user_id=str(user.id))
    return {"ok": True}


@router.post("/{activity_id}/leave")
def leave_activity(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    from uuid import UUID
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


@router.get("/{activity_id}/attendees")
def list_attendees(
    activity_id: str,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    from uuid import UUID
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")

    is_creator = str(a.creator_id) == str(user.id)

    members = db.execute(
        select(ActivityMember, User).join(User, ActivityMember.user_id == User.id).where(ActivityMember.activity_id == a.id)
    ).all()
    return [
        {
            "user_id": str(m.user_id),
            "name": u.name or u.email,
            "email": u.email if is_creator else None,
            "photo_url": u.photo_url,
            "attended": m.attended,
            "joined_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m, u in members
    ]


class _AttendeeAction(BaseModel):
    attended: bool


@router.post("/{activity_id}/attendees/{target_user_id}/attended")
def mark_attendance(
    activity_id: str,
    target_user_id: str,
    body: _AttendeeAction,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    from uuid import UUID
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
    from uuid import UUID
    a = db.get(Activity, UUID(activity_id))
    if not a:
        raise ApiError(ErrorCode.activity_not_found, "activity not found")
    if str(a.creator_id) != str(user.id):
        raise ApiError(ErrorCode.activity_not_creator, "solo el creador puede ampliar cupos")

    a.max_participants = (a.max_participants or 0) + body.additional
    db.commit()
    return {"ok": True, "max_participants": a.max_participants}
