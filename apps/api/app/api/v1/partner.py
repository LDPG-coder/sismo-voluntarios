"""SEP Partner API — server-to-server notifications for SEP's own header.

SEP's backend calls these endpoints (authenticated with the shared
`SISMO_SEP_API_TOKEN`) to render SISMO's notifications inside SEP's general
header, without embedding SISMO's UI. The contract mirrors
`docs/SEP_INTEGRATION_COOKBOOK.md`.
"""

from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.db.base import get_db
from app.db.models import Notification, User

router = APIRouter(prefix="/partner/v1", tags=["partner"])


def require_sep_partner_token(
    authorization: str = Header(None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.sep_api_token:
        raise ApiError(
            ErrorCode.auth_sep_unauthorized,
            "SEP partner API is not configured",
        )
    expected = f"Bearer {settings.sep_api_token}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise ApiError(ErrorCode.auth_sep_token_invalid, "invalid SEP API token")


def _serialize_notification(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "activity_id": str(n.activity_id) if n.activity_id else None,
        "read": n.read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def _user_by_sep_id(db: Session, sep_user_id: str) -> User | None:
    return db.execute(
        select(User).where(User.sep_user_id == sep_user_id)
    ).scalar_one_or_none()


@router.get("/users/{sep_user_id}/notifications/summary")
def partner_notifications_summary(
    sep_user_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_sep_partner_token)] = None,
) -> dict:
    user = _user_by_sep_id(db, sep_user_id)
    if not user:
        return {"unread": 0, "items": []}
    unread = (
        db.execute(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user.id, Notification.read.is_(False))
        ).scalar()
        or 0
    )
    notifs = (
        db.execute(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )
    return {"unread": unread, "items": [_serialize_notification(n) for n in notifs]}


@router.get("/users/{sep_user_id}/notifications")
def partner_notifications_list(
    sep_user_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_sep_partner_token)] = None,
) -> list[dict]:
    user = _user_by_sep_id(db, sep_user_id)
    if not user:
        return []
    notifs = (
        db.execute(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    return [_serialize_notification(n) for n in notifs]
