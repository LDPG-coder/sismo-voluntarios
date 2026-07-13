"""Auth endpoints with invitation system."""

from __future__ import annotations

import urllib.parse
import hmac
import time
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.core.utils import generate_referral_code, is_invitation_expired, serialize_user
from app.db.base import get_db
from app.db.constants import MVP_TENANT_ID
from app.db.enums import UserRole, UserStatus
from app.db.models import User
from app.pipeline import oauth
from app.pipeline.dependencies import SESSION_COOKIE_NAME, require_admin_session, require_session
from app.pipeline.session import SessionPayload, decode_session, encode_session

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

    from app.pipeline.session_store import issue_refresh

    refresh_token = issue_refresh(str(entry.user_id), entry.role, entry.status)
    return {
        "user_id": str(entry.user_id),
        "role": entry.role,
        "status": entry.status,
        "refresh_token": refresh_token,
        "access_max_age": settings.session_max_age_seconds,
        "refresh_max_age": settings.session_refresh_max_age_seconds,
    }


class _RefreshBody(BaseModel):
    refresh_token: str


@router.post("/refresh")
def auth_refresh(
    body: _RefreshBody,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Rotate a refresh token and return a fresh access identity.

    Authentication is the refresh token itself (an HttpOnly cookie the web
    proxies here), not the session cookie, so this endpoint is CSRF-exempt on
    the API side. The returned tokens are set as cookies by the web route;
    the API never sets cookies on the web's domain.
    """
    from app.pipeline.session_store import consume_refresh, issue_refresh

    payload = consume_refresh(body.refresh_token)
    if not payload:
        raise ApiError(ErrorCode.auth_session_revoked, "refresh token invalid or expired")

    try:
        user = db.get(User, UUID(payload["user_id"]))
    except (ValueError, TypeError):
        raise ApiError(ErrorCode.auth_unauthenticated, "user not found")
    if user is None:
        raise ApiError(ErrorCode.auth_unauthenticated, "user not found")

    new_refresh = issue_refresh(str(user.id), user.role, user.status)
    return {
        "user_id": str(user.id),
        "role": user.role,
        "status": user.status,
        "refresh_token": new_refresh,
        "access_max_age": settings.session_max_age_seconds,
        "refresh_max_age": settings.session_refresh_max_age_seconds,
    }


# -- SEP platform login (server-to-server) -------------------------

# SEP auto-provisions its own users; external/public accounts are separate.
_SEP_DEFAULT_ROLE = UserRole.volunteer.value
_SEP_DEFAULT_STATUS = UserStatus.active.value


class _SepLoginBody(BaseModel):
    sep_user_id: str
    email: str
    name: str | None = None
    role: str | None = None


def _resolve_or_create_sep_user(
    db: Session, *, sep_user_id: str, email: str, name: str | None, role: str | None
) -> User:
    """Find or create the SISMO account for a SEP-platform user.

    SEP and external (Google) populations are distinct: lookup is by the SEP
    stable id, never by email, so a SEP user is never merged with a Google one.
    """
    user = db.execute(
        select(User).where(User.sep_user_id == sep_user_id)
    ).scalar_one_or_none()
    if user is not None:
        user.email = email.lower()
        if name:
            user.name = name
        # SEP is NOT authoritative for SISMO roles. It may only assert the
        # volunteer role; admin promotion happens exclusively through the
        # admin-only PATCH /users/{id} endpoint. This prevents a leaked
        # SEP_API_TOKEN from minting admin accounts.
        if role == UserRole.volunteer.value:
            user.role = role
        db.commit()
        db.refresh(user)
        return user

    # New SEP-provisioned accounts are always volunteers. Never trust the
    # caller-supplied role here.
    effective_role = _SEP_DEFAULT_ROLE
    new_user = User(
        email=email.lower(),
        name=name,
        auth_source="sep",
        sep_user_id=sep_user_id,
        role=effective_role,
        status=_SEP_DEFAULT_STATUS,
        referral_code=generate_referral_code(),
    )
    new_user.tenant_id = MVP_TENANT_ID
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    _log.info("auth.sep.created", sep_user_id=sep_user_id, user_id=str(new_user.id))
    return new_user


@router.post("/sep-login")
def auth_sep_login(
    body: _SepLoginBody,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Exchange a SEP-authenticated identity for a one-time login code.

    Called server-to-server by the SEP platform backend (not by the browser).
    SEP proves its identity with `Authorization: Bearer <SISMO_SEP_API_TOKEN>`.
    The returned single-use, short-TTL code is then given to the browser, which
    redeems it at the web route `/auth/sep` to obtain a normal session cookie —
    reusing the exact same mechanism as the Google OAuth flow.
    """
    if not settings.sep_api_token:
        raise ApiError(
            ErrorCode.auth_sep_unauthorized,
            "SEP login is not configured",
        )
    auth_header = request.headers.get("authorization", "")
    expected = f"Bearer {settings.sep_api_token}"
    if not auth_header or not hmac.compare_digest(auth_header, expected):
        raise ApiError(ErrorCode.auth_sep_token_invalid, "invalid SEP API token")

    sep_user_id = body.sep_user_id.strip()
    email = body.email.strip().lower()
    if not sep_user_id or not email:
        raise ApiError(ErrorCode.validation_missing_field, "sep_user_id and email are required")

    user = _resolve_or_create_sep_user(
        db, sep_user_id=sep_user_id, email=email, name=body.name, role=body.role
    )
    user.last_login_at = datetime.now(UTC)
    db.commit()

    code = oauth.issue_exchange_code(
        db,
        user_id=user.id,
        role=user.role,
        status=user.status,
        ttl=float(settings.oauth_exchange_ttl_seconds),
    )
    _log.info("auth.sep.login", sep_user_id=sep_user_id, user_id=str(user.id))
    return {"code": code}


@router.post("/logout", status_code=204, response_class=Response)
def auth_logout(
    user: Annotated[User, Depends(require_session)],
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    # Server-side invalidation: mark this session's jti as revoked so the
    # cookie stops working even if a copy was stolen. TTL matches the
    # cookie's remaining lifetime so the denylist entry self-expires.
    from app.pipeline.session_store import revoke_refresh, revoke_session

    raw = request.cookies.get(SESSION_COOKIE_NAME)
    result = decode_session(settings, raw)
    if result.ok and result.payload and result.payload.jti:
        exp = result.payload.exp
        ttl = int(exp - int(time.time())) if exp else settings.session_max_age_seconds
        revoke_session(result.payload.jti, max(1, ttl))

    # Also revoke the refresh token so it cannot mint a new access token.
    refresh = request.cookies.get(settings.session_refresh_cookie_name)
    if refresh:
        revoke_refresh(refresh)

    response = Response(status_code=204)
    delete_kwargs: dict = dict(path="/")
    if settings.cookie_domain:
        delete_kwargs["domain"] = settings.cookie_domain
    response.delete_cookie(SESSION_COOKIE_NAME, **delete_kwargs)
    response.delete_cookie(settings.session_refresh_cookie_name, **delete_kwargs)
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
        # Allow re-issuing an *expired* pending invitation (new code, same
        # account) so an admin can refresh a lapsed invite without dupes.
        if is_invitation_expired(existing, settings.referral_expiry_days):
            existing.referral_code = generate_referral_code()
            db.commit()
            db.refresh(existing)
            _log.info("auth.invite.reissued", email=email, invited_by=str(user.id))
            return {"id": str(existing.id), "email": existing.email, "referral_code": existing.referral_code}
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
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    u = db.execute(select(User).where(User.referral_code == body.code.upper())).scalar_one_or_none()
    if not u or is_invitation_expired(u, settings.referral_expiry_days):
        raise ApiError(ErrorCode.referral_invalid, "código de referido inválido o expirado")
    return {"valid": True}
