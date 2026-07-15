"""User admin endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.core.utils import serialize_user, validate_enum
from app.db.base import get_db
from app.db.enums import UserRole, UserStatus
from app.db.models import Activity, ActivityMember, MediaAsset, MediaOwnerType, User
from app.pipeline.dependencies import require_admin_session, require_session
from app.storage.service import (
    MediaError,
    decode_data_url,
    delete_media,
    media_url,
    save_media,
)

router = APIRouter(prefix="/users", tags=["users"])
_log = get_logger("app.api.v1.users")


@router.get("")
def list_users(
    admin: Annotated[User, Depends(require_admin_session)],
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
) -> dict:
    q = select(User)
    count_q = select(func.count()).select_from(User)

    if search:
        like = f"%{search}%"
        q = q.where(User.email.ilike(like) | User.name.ilike(like))
        count_q = count_q.where(User.email.ilike(like) | User.name.ilike(like))

    total = db.execute(count_q).scalar() or 0
    offset = (page - 1) * page_size
    users = db.execute(q.order_by(User.created_at.desc()).offset(offset).limit(page_size)).scalars().all()

    return {
        "users": [serialize_user(u, include_phone=True) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/directory")
def user_directory(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
    search: str | None = None,
    limit: int = Query(10, ge=1, le=50),
    activity_id: str | None = None,
) -> list[dict]:
    # The directory powers "ceder cupo". SEP users and admins can browse every
    # account; external (Google) users can only ceder among other externals,
    # so they only see external accounts here. (Ceder to an ineligible target
    # is also enforced server-side in POST /activities/{id}/transfer.)
    is_external = user.auth_source == "google" and user.role != UserRole.admin.value

    q = select(User).where(User.id != user.id)
    if is_external:
        q = q.where(User.auth_source == "google")

    if activity_id:
        try:
            a = db.get(Activity, UUID(activity_id))
        except ValueError:
            a = None
        if a:
            member_ids = db.execute(
                select(ActivityMember.user_id).where(
                    ActivityMember.activity_id == a.id,
                    ActivityMember.status == "active",
                )
            ).scalars().all()
            exclude = {UUID(str(m)) for m in member_ids}
            if a.creator_id is not None:
                exclude.add(UUID(str(a.creator_id)))
            if exclude:
                q = q.where(User.id.notin_(exclude))

    if search:
        like = f"%{search.strip()}%"
        q = q.where(User.name.ilike(like) | User.email.ilike(like))
    users = db.execute(q.order_by(User.name.asc()).limit(limit)).scalars().all()
    return [
        {"id": str(u.id), "name": u.name or u.email, "photo_url": u.photo_url}
        for u in users
    ]


@router.get("/{user_id}")
def get_user(
    user_id: str,
    admin: Annotated[User, Depends(require_admin_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    u = db.get(User, UUID(user_id))
    if not u:
        raise ApiError(ErrorCode.user_not_found, "user not found")
    return serialize_user(u, include_phone=True)


class _UpdateUserBody(BaseModel):
    role: str | None = None
    status: str | None = None
    phone: str | None = None
    name: str | None = None


class _UpdatePhotoBody(BaseModel):
    photo: str | None = None


@router.put("/{user_id}")
def update_user(
    user_id: str,
    body: _UpdateUserBody,
    admin: Annotated[User, Depends(require_admin_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    u = db.get(User, UUID(user_id))
    if not u:
        raise ApiError(ErrorCode.user_not_found, "user not found")

    if body.role is not None:
        try:
            validate_enum(body.role, UserRole, "role")
        except ValueError as e:
            raise ApiError(ErrorCode.validation_invalid_format, str(e))
        u.role = body.role

    if body.status is not None:
        try:
            validate_enum(body.status, UserStatus, "status")
        except ValueError as e:
            raise ApiError(ErrorCode.validation_invalid_format, str(e))
        u.status = body.status

    if body.phone is not None:
        u.phone = body.phone

    if body.name is not None:
        u.name = body.name

    # A role/status change must take effect immediately and invalidate any
    # outstanding refresh tokens so a stale token cannot mint a new session
    # with the old (or escalated) role. Access tokens are short-lived and the
    # per-request DB role/status check enforces the change on the next call.
    if body.role is not None or body.status is not None:
        from app.pipeline.session_store import revoke_user_sessions

        revoke_user_sessions(str(u.id))

    db.commit()
    db.refresh(u)
    _log.info("user.updated", user_id=str(u.id), admin_id=str(admin.id))
    return serialize_user(u, include_phone=True)


_MAX_PHOTO_LEN = 5 * 1024 * 1024


def _clear_photo_asset(db: Session, user: User) -> None:
    if user.photo_asset_id:
        asset = db.get(MediaAsset, user.photo_asset_id)
        if asset:
            delete_media(db, asset)
    user.photo_asset_id = None


@router.put("/me/photo")
def update_my_photo(
    body: _UpdatePhotoBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    photo = body.photo
    if photo is None:
        # Limpiar la foto actual (asset + referencia).
        _clear_photo_asset(db, user)
        user.photo_url = None
        db.commit()
        db.refresh(user)
        _log.info("user.photo.cleared", user_id=str(user.id))
        return serialize_user(user, include_phone=True)

    if not isinstance(photo, str) or not photo.startswith("data:image/"):
        raise ApiError(ErrorCode.validation_invalid_format, "photo must be a data: image URL")
    try:
        mime, raw = decode_data_url(photo)
    except MediaError as e:
        raise ApiError(ErrorCode.validation_invalid_format, str(e))
    if len(raw) > _MAX_PHOTO_LEN:
        raise ApiError(ErrorCode.validation_invalid_format, "photo is too large")

    _clear_photo_asset(db, user)
    asset = save_media(
        db,
        owner_type=MediaOwnerType.USER_PHOTO,
        owner_id=user.id,
        kind="image",
        content_type=mime,
        data=raw,
        created_by=user.id,
        filename="photo",
    )
    db.flush()
    user.photo_asset_id = asset.id
    # La columna conserva la URL pública como referencia (sin base64).
    user.photo_url = media_url(asset)
    db.commit()
    db.refresh(user)
    _log.info("user.photo.updated", user_id=str(user.id))
    return serialize_user(user, include_phone=True)


@router.delete("/me/photo")
def delete_my_photo(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    _clear_photo_asset(db, user)
    user.photo_url = None
    db.commit()
    db.refresh(user)
    _log.info("user.photo.deleted", user_id=str(user.id))
    return serialize_user(user, include_phone=True)


@router.post("/me/photo/reset")
def reset_my_photo(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    _clear_photo_asset(db, user)
    user.photo_url = user.google_photo_url
    db.commit()
    db.refresh(user)
    _log.info("user.photo.reset", user_id=str(user.id))
    return serialize_user(user, include_phone=True)
