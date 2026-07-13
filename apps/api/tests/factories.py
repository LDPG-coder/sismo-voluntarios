"""Shared test factories and auth helpers."""

from __future__ import annotations

import uuid

from app.core.config import get_settings
from app.core.utils import generate_referral_code
from app.db.models import User
from app.pipeline.session import SessionPayload, encode_session


def make_user(
    session,
    *,
    email: str | None = None,
    role: str = "volunteer",
    status: str = "active",
    auth_source: str = "google",
    referral_code: str | None = None,
    created_at=None,
    sep_user_id: str | None = None,
):
    if email is None:
        email = f"user-{uuid.uuid4().hex[:10]}@example.com"
    user = User(
        email=email,
        role=role,
        status=status,
        auth_source=auth_source,
        referral_code=referral_code or generate_referral_code(),
        sep_user_id=sep_user_id,
    )
    if created_at is not None:
        user.created_at = created_at
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def session_token(user, *, jti: str | None = None) -> str:
    settings = get_settings()
    return encode_session(
        settings,
        SessionPayload(
            user_id=user.id, role=user.role, status=user.status, jti=jti
        ),
    )


def auth_cookies(user) -> dict:
    return {
        "sismo_session": session_token(user),
        "XSRF-TOKEN": "csrf-test-token",
    }


def auth_headers() -> dict:
    return {"X-CSRF-Token": "csrf-test-token"}
