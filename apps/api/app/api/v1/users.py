"""User admin endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.db.base import get_db
from app.db.enums import UserRole, UserStatus
from app.db.models import User
from app.pipeline.dependencies import require_admin_session, require_session

router = APIRouter(prefix="/users", tags=["users"])
_log = get_logger("app.api.v1.users")


def _serialize_user(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "name": u.name,
        "photo_url": u.photo_url,
        "phone": u.phone,
        "role": u.role,
        "status": u.status,
        "referral_code": u.referral_code,
        "referred_by": str(u.referred_by) if u.referred_by else None,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


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
        "users": [_serialize_user(u) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{user_id}")
def get_user(
    user_id: str,
    admin: Annotated[User, Depends(require_admin_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    from uuid import UUID
    u = db.get(User, UUID(user_id))
    if not u:
        raise ApiError(ErrorCode.user_not_found, "user not found")
    return _serialize_user(u)


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
    from uuid import UUID
    u = db.get(User, UUID(user_id))
    if not u:
        raise ApiError(ErrorCode.user_not_found, "user not found")

    if body.role is not None:
        try:
            UserRole(body.role)
        except ValueError:
            raise ApiError(ErrorCode.validation_invalid_format, f"invalid role: {body.role}")
        u.role = body.role

    if body.status is not None:
        try:
            UserStatus(body.status)
        except ValueError:
            raise ApiError(ErrorCode.validation_invalid_format, f"invalid status: {body.status}")
        u.status = body.status

    if body.phone is not None:
        u.phone = body.phone

    if body.name is not None:
        u.name = body.name

    db.commit()
    db.refresh(u)
    _log.info("user.updated", user_id=str(u.id), admin_id=str(admin.id))
    return _serialize_user(u)


_MAX_PHOTO_LEN = 3_500_000


@router.put("/me/photo")
def update_my_photo(
    body: _UpdatePhotoBody,
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    photo = body.photo
    if photo is not None:
        if not isinstance(photo, str) or not photo.startswith("data:image/"):
            raise ApiError(ErrorCode.validation_invalid_format, "photo must be a data: image URL")
        if len(photo) > _MAX_PHOTO_LEN:
            raise ApiError(ErrorCode.validation_invalid_format, "photo is too large")
    user.photo_url = photo
    db.commit()
    db.refresh(user)
    _log.info("user.photo.updated", user_id=str(user.id))
    return _serialize_user(user)


@router.delete("/me/photo")
def delete_my_photo(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    user.photo_url = None
    db.commit()
    db.refresh(user)
    _log.info("user.photo.deleted", user_id=str(user.id))
    return _serialize_user(user)


@router.post("/me/photo/reset")
def reset_my_photo(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    user.photo_url = user.google_photo_url
    db.commit()
    db.refresh(user)
    _log.info("user.photo.reset", user_id=str(user.id))
    return _serialize_user(user)
