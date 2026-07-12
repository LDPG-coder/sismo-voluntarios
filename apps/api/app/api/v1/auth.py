"""Auth endpoints with invitation system."""

from __future__ import annotations

import urllib.parse
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.core.utils import generate_referral_code, serialize_user
from app.db.base import get_db
from app.db.constants import MVP_TENANT_ID
from app.db.enums import UserRole, UserStatus
from app.db.models import User
from app.pipeline import oauth
from app.pipeline.dependencies import SESSION_COOKIE_NAME, require_admin_session, require_session
from app.pipeline.session import SessionPayload, encode_session

router = APIRouter(prefix="/auth", tags=["auth"])
_log = get_logger("app.api.v1.auth")

_FINISH_PATH = "/auth/finish"
_LOGIN_PATH = "/login"


def _web_origin(settings: Settings) -> str:
    if settings.web_origin:
        return settings.web_origin.rstrip("/")
    raw = settings.api_cors_origins[0] if settings.api_cors_origins else "http://localhost:3001"
    return raw.rstrip("/")


def _redirect(target: str) -> Response:
    return Response(status_code=302, headers={"Location": target})


# -- Public OAuth endpoints ----------------------------------------


@router.get("/login")
def auth_login(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    if not settings.oauth_enabled:
        raise ApiError(ErrorCode.auth_oauth_not_configured, "Google OAuth is not configured")
    state = oauth.issue_oauth_state(db)
    target = oauth.build_google_authorize_url(settings, state=state)
    _log.info("oauth.login.redirect", target_host=urllib.parse.urlparse(target).netloc)
    return _redirect(target)


@router.get("/callback")
def auth_callback(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
    code: str | None = None,
    state: str | None = None,
) -> Response:
    if not settings.oauth_enabled:
        raise ApiError(ErrorCode.auth_oauth_not_configured, "Google OAuth is not configured")
    if not code or not state:
        return _redirect(f"{_web_origin(settings)}{_LOGIN_PATH}?error=oauth_missing_params")

    try:
        outcome = oauth.complete_google_callback(db, settings, code=code, state=state)
    except oauth.OAuthStateError:
        return _redirect(f"{_web_origin(settings)}{_LOGIN_PATH}?error=oauth_state")
    except oauth.OAuthCodeExchangeError as exc:
        _log.error("oauth.callback.code_exchange_failed", error=str(exc))
        return _redirect(f"{_web_origin(settings)}{_LOGIN_PATH}?error=oauth_exchange")
    except oauth.OAuthIdTokenError as exc:
        _log.error("oauth.callback.id_token_invalid", error=str(exc))
        return _redirect(f"{_web_origin(settings)}{_LOGIN_PATH}?error=oauth_id_token")
    except oauth.OAuthNotInvitedError:
        return _redirect(f"{_web_origin(settings)}{_LOGIN_PATH}?error=not_invited")

    user = outcome.user
    user.last_login_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)

    one_time_code = oauth.issue_exchange_code(
        db, user_id=user.id, role=user.role, status=user.status,
        ttl=float(settings.oauth_exchange_ttl_seconds),
    )
    _log.info("oauth.callback.success", user_id=str(user.id), role=user.role, created=outcome.created)
    target = f"{_web_origin(settings)}{_FINISH_PATH}?code={urllib.parse.quote(one_time_code)}"
    return _redirect(target)


class _ExchangeBody(BaseModel):
    code: str


@router.post("/exchange")
def auth_exchange(
    body: _ExchangeBody,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    try:
        entry = oauth.consume_exchange_code(db, body.code, ttl=float(settings.oauth_exchange_ttl_seconds))
    except oauth.OAuthStateError as exc:
        raise ApiError(ErrorCode.auth_oauth_code_invalid, str(exc)) from exc

    return {"user_id": str(entry.user_id), "role": entry.role, "status": entry.status}


@router.post("/logout", status_code=204, response_class=Response)
def auth_logout(
    user: Annotated[User, Depends(require_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    response = Response(status_code=204)
    delete_kwargs: dict = dict(path="/")
    if settings.cookie_domain:
        delete_kwargs["domain"] = settings.cookie_domain
    response.delete_cookie(SESSION_COOKIE_NAME, **delete_kwargs)
    return response


# -- Authenticated endpoints ---------------------------------------


@router.get("/me")
def get_me(user: Annotated[User, Depends(require_session)]) -> dict:
    return serialize_user(user)


@router.post("/me/photo/reset", status_code=200)
def reset_photo(
    user: Annotated[User, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    user.photo_url = user.google_photo_url
    db.commit()
    db.refresh(user)
    return serialize_user(user)


class _InviteBody(BaseModel):
    email: str


@router.post("/invite")
def invite_user(
    body: _InviteBody,
    user: Annotated[User, Depends(require_admin_session)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    email = body.email.lower().strip()
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        raise ApiError(ErrorCode.user_email_exists, f"email {email!r} already registered")

    referral_code = generate_referral_code()
    new_user = User(
        email=email,
        name=None,
        role=UserRole.volunteer.value,
        status=UserStatus.pending.value,
        referral_code=referral_code,
        referred_by=user.id,
    )
    new_user.tenant_id = MVP_TENANT_ID
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    _log.info("auth.invite.created", email=email, invited_by=str(user.id))
    return {"id": str(new_user.id), "email": new_user.email, "referral_code": new_user.referral_code}


class _ReferralBody(BaseModel):
    code: str


@router.post("/referral")
def validate_referral(
    body: _ReferralBody,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    u = db.execute(select(User).where(User.referral_code == body.code.upper())).scalar_one_or_none()
    if not u:
        raise ApiError(ErrorCode.referral_invalid, "código de referido inválido")
    return {"valid": True}
