"""Google OAuth flow with invitation-only registration."""

from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.logging import get_logger
from app.db.enums import UserRole, UserStatus
from app.db.models import OAuthExchangeCode, OAuthState, User

_log = get_logger("app.pipeline.oauth")

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"

_DEFAULT_CODE_TTL = 300.0


class OAuthError(Exception):
    code: str

    def __init__(self, message: str, *, code: str = "auth.oauth_error") -> None:
        super().__init__(message)
        self.code = code


class OAuthStateError(OAuthError):
    pass


class OAuthCodeExchangeError(OAuthError):
    pass


class OAuthIdTokenError(OAuthError):
    pass


class OAuthNotInvitedError(OAuthError):
    pass


# -- Database-backed stores ----------------------------------------


def store_state(db: Session, state: str, return_to: str | None) -> None:
    db.add(OAuthState(state=state, created_at=_now(), return_to=return_to, consumed=False))
    db.commit()


def consume_state(db: Session, state: str, ttl: float):
    row = db.query(OAuthState).filter(OAuthState.state == state).first()
    if row is None:
        raise OAuthStateError("state not found (already consumed or never issued)")
    if row.consumed:
        raise OAuthStateError("state already consumed")
    now = _now()
    if now.timestamp() - row.created_at.timestamp() > ttl:
        raise OAuthStateError("state expired")
    row.consumed = True
    db.commit()


def store_code(db: Session, *, user_id: uuid.UUID, role: str, status: str, ttl: float) -> str:
    code = secrets.token_urlsafe(32)
    db.add(OAuthExchangeCode(code=code, user_id=user_id, role=role, status=status, created_at=_now(), consumed=False))
    db.commit()
    return code


def consume_code(db: Session, code: str, ttl: float):
    row = db.query(OAuthExchangeCode).filter(OAuthExchangeCode.code == code).first()
    if row is None:
        raise OAuthStateError("exchange code not found")
    if row.consumed:
        raise OAuthStateError("exchange code already consumed")
    now = _now()
    if now.timestamp() - row.created_at.timestamp() > ttl:
        raise OAuthStateError("exchange code expired")
    row.consumed = True
    db.commit()
    return row


def _now() -> Any:
    return datetime.now(UTC)


# -- Google token endpoint -----------------------------------------


def build_google_authorize_url(settings: Settings, *, state: str) -> str:
    params = {
        "client_id": settings.google_client_id or "",
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(settings.google_oauth_scopes),
        "state": state,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "select_account",
    }
    return f"{_GOOGLE_AUTH_URL}?{urlencode(params)}"


def _exchange_code_for_tokens(settings: Settings, *, code: str) -> dict[str, Any]:
    if not settings.google_client_id or not settings.google_client_secret:
        raise OAuthCodeExchangeError("Google OAuth is not configured")
    data = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }
    try:
        response = httpx.post(_GOOGLE_TOKEN_URL, data=data, timeout=10.0)
    except httpx.HTTPError as exc:
        raise OAuthCodeExchangeError(f"token endpoint unreachable: {exc}") from exc
    if response.status_code != 200:
        _log.error("oauth.token_exchange_failed", status=response.status_code, body=response.text[:500])
        raise OAuthCodeExchangeError(f"token endpoint returned {response.status_code}")
    try:
        return response.json()
    except ValueError as exc:
        raise OAuthCodeExchangeError(f"token endpoint returned non-JSON: {exc}") from exc


def _verify_id_token(settings: Settings, *, id_token: str) -> dict[str, Any]:
    if not settings.google_client_id:
        raise OAuthIdTokenError("Google OAuth is not configured")

    import jwt
    from jwt import PyJWKClient

    try:
        client = PyJWKClient(_GOOGLE_CERTS_URL)
        signing_key = client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
        )
    except jwt.PyJWTError as exc:
        _log.error("oauth.id_token_verification_failed", error=str(exc))
        raise OAuthIdTokenError(f"id_token verification failed: {exc}") from exc

    if "sub" not in claims or "email" not in claims:
        raise OAuthIdTokenError("id_token missing required claims (sub, email)")
    return claims


# -- Invitation-only user resolution ------------------------------


@dataclass
class AuthenticatedUser:
    user: User
    created: bool


def _find_by_google_subject(db: Session, google_subject: str) -> User | None:
    return db.execute(select(User).where(User.google_subject == google_subject)).scalar_one_or_none()


def _find_by_email(db: Session, email: str) -> User | None:
    return db.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()


def _resolve_or_create_user(
    db: Session,
    *,
    settings: Settings,
    google_subject: str,
    email: str,
    name: str,
    photo_url: str = "",
) -> AuthenticatedUser:
    email = email.lower()

    # 1. Already has active account
    user = _find_by_google_subject(db, google_subject)
    if user is not None:
        user.google_photo_url = photo_url or None
        if user.photo_url is None and photo_url:
            user.photo_url = photo_url
        db.commit()
        db.refresh(user)
        return AuthenticatedUser(user=user, created=False)

    # 2. Pending user exists (invited by someone)
    user = _find_by_email(db, email)
    if user is not None:
        if user.status == UserStatus.pending:
            user.google_subject = google_subject
            if name:
                user.name = name
            user.google_photo_url = photo_url or None
            if user.photo_url is None and photo_url:
                user.photo_url = photo_url
            user.status = UserStatus.active
            db.commit()
            db.refresh(user)
            _log.info("oauth.user.activated", email=email, user_id=str(user.id))
            return AuthenticatedUser(user=user, created=True)
        # Already active
        user.google_subject = google_subject
        if name and not user.name:
            user.name = name
        user.google_photo_url = photo_url or None
        if user.photo_url is None and photo_url:
            user.photo_url = photo_url
        db.commit()
        db.refresh(user)
        return AuthenticatedUser(user=user, created=False)

    # 3. Not invited — block
    raise OAuthNotInvitedError(
        f"email {email!r} no tiene invitación. Pide a un voluntario que te invite."
    )


# -- Public surface ------------------------------------------------


def issue_oauth_state(db: Session, return_to: str | None = None) -> str:
    state = secrets.token_urlsafe(32)
    store_state(db, state, return_to)
    return state


def consume_oauth_state(db: Session, state: str, ttl: float = _DEFAULT_CODE_TTL):
    return consume_state(db, state, ttl)


def issue_exchange_code(
    db: Session, *, user_id: uuid.UUID, role: str, status: str, ttl: float = _DEFAULT_CODE_TTL
) -> str:
    return store_code(db, user_id=user_id, role=role, status=status, ttl=ttl)


def consume_exchange_code(db: Session, code: str, ttl: float = _DEFAULT_CODE_TTL):
    return consume_code(db, code, ttl)


def complete_google_callback(
    db: Session, settings: Settings, *, code: str, state: str
) -> AuthenticatedUser:
    consume_oauth_state(db, state, ttl=settings.oauth_exchange_ttl_seconds)

    token_response = _exchange_code_for_tokens(settings, code=code)
    id_token_str = token_response.get("id_token")
    if not id_token_str:
        raise OAuthCodeExchangeError("token response missing id_token")

    claims = _verify_id_token(settings, id_token=id_token_str)
    google_subject = claims["sub"]
    email = claims["email"]
    name = claims.get("name", "")
    photo_url = claims.get("picture", "")

    return _resolve_or_create_user(
        db, settings=settings, google_subject=google_subject, email=email, name=name, photo_url=photo_url,
    )
