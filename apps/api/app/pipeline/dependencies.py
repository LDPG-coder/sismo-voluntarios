"""FastAPI auth dependencies."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.db.base import get_db
from app.db.enums import UserRole, UserStatus
from app.db.models import User
from app.pipeline.session import SessionPayload, decode_session

_log = get_logger("app.pipeline.dependencies")

SESSION_COOKIE_NAME = "sismo_session"


def _read_cookie(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE_NAME)


def _payload_or_401(settings: Settings, request: Request) -> SessionPayload:
    raw = _read_cookie(request)
    result = decode_session(settings, raw)
    if not result.ok or result.payload is None:
        raise ApiError(
            ErrorCode.auth_unauthenticated,
            f"invalid session cookie: {result.reason or 'unknown'}",
        )
    return result.payload


def _user_or_404(db: Session, user_id: uuid.UUID) -> User:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise ApiError(ErrorCode.user_not_found, f"user not found: {user_id}")
    return user


def _user_active(user: User) -> None:
    if user.status != UserStatus.active:
        raise ApiError(
            ErrorCode.auth_forbidden,
            f"user is {user.status.value}; sign in again to refresh",
        )


def make_require_session(
    *,
    role: UserRole | None,
    optional: bool = False,
) -> Callable[..., User | None]:
    def _dependency(
        request: Request,
        settings: Annotated[Settings, Depends(get_settings)],
        db: Annotated[Session, Depends(get_db)],
    ) -> User | None:
        raw = _read_cookie(request)
        if optional and not raw:
            return None
        payload = _payload_or_401(settings, request)
        user = _user_or_404(db, payload.user_id)
        _user_active(user)
        if role == UserRole.admin and user.role != UserRole.admin:
            if optional:
                return None
            raise ApiError(ErrorCode.auth_forbidden, "admin role required")
        return user

    return _dependency


require_session = make_require_session(role=None)
require_admin_session = make_require_session(role=UserRole.admin)
