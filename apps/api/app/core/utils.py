"""Shared utility functions."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta, timezone
from enum import Enum
from typing import Any

from app.db.constants import DEFAULT_TIMEZONE_OFFSET

_MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
_DIAS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


def generate_referral_code() -> str:
    return secrets.token_urlsafe(6).upper()[:8]


def serialize_user(user: Any, *, include_phone: bool = False) -> dict:
    result = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "photo_url": user.photo_url,
        "role": user.role,
        "status": user.status,
        "referral_code": user.referral_code,
        "referred_by": str(user.referred_by) if user.referred_by else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
    if include_phone:
        result["phone"] = user.phone
    return result


def ensure_timezone(dt: datetime, offset: timedelta | None = None) -> datetime:
    if dt.tzinfo is None:
        if offset is None:
            offset = DEFAULT_TIMEZONE_OFFSET
        return dt.replace(tzinfo=timezone(offset))
    return dt


def format_venezuela_now(offset_hours: int = -4) -> tuple[str, datetime]:
    """Return (human-readable Spanish date string, aware datetime) for Venezuela."""
    now = datetime.now(timezone(timedelta(hours=offset_hours)))
    human = (
        f"{_DIAS_ES[now.weekday()]} {now.day} de {_MESES_ES[now.month - 1]} "
        f"de {now.year}, {now.hour:02d}:{now.minute:02d} "
        f"(hora de Venezuela, UTC{offset_hours:+d})"
    )
    return human, now


def validate_enum(value: str, enum_class: type[Enum], field_name: str) -> None:
    try:
        enum_class(value)
    except ValueError:
        valid_values = [e.value for e in enum_class]
        raise ValueError(f"invalid {field_name}: {value!r}. Must be one of: {valid_values}")
