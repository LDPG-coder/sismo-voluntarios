"""Session cookie helpers."""

from __future__ import annotations

import base64
import hmac
import json
import time
import uuid
from dataclasses import dataclass
from hashlib import sha256
from typing import Literal

from app.core.config import Settings

UserRoleStr = Literal["volunteer", "admin"]
UserStatusStr = Literal["pending", "active", "suspended"]


@dataclass(frozen=True)
class SessionPayload:
    user_id: uuid.UUID
    role: UserRoleStr
    status: UserStatusStr
    iat: int | None = None
    exp: int | None = None


@dataclass(frozen=True)
class VerifyResult:
    ok: bool
    payload: SessionPayload | None = None
    reason: str | None = None


_SEP = "."
_DEV_SESSION_SECRET = "dev-only-session-secret-do-not-use-in-production"


def _secret(settings: Settings) -> str:
    secret = settings.session_secret
    if secret:
        return secret
    if settings.env == "production":
        raise RuntimeError(
            "SISMO_SESSION_SECRET is required in production. "
            "Generate one with `openssl rand -hex 32` and set it in the secret manager."
        )
    return _DEV_SESSION_SECRET


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def encode_session(settings: Settings, payload: SessionPayload) -> str:
    now = int(time.time())
    exp = now + int(settings.session_max_age_seconds)
    json_bytes = json.dumps(
        {
            "user_id": str(payload.user_id),
            "role": payload.role,
            "status": payload.status,
            "iat": now,
            "exp": exp,
        },
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    encoded = _b64url_encode(json_bytes)
    mac = hmac.new(
        _secret(settings).encode("utf-8"),
        encoded.encode("ascii"),
        sha256,
    ).hexdigest()
    return f"{encoded}{_SEP}{mac}"


def decode_session(settings: Settings, value: str | None) -> VerifyResult:
    if not value:
        return VerifyResult(ok=False, reason="missing")
    idx = value.rfind(_SEP)
    if idx <= 0 or idx == len(value) - 1:
        return VerifyResult(ok=False, reason="malformed")
    encoded = value[:idx]
    provided_mac = value[idx + 1 :]
    expected_mac = hmac.new(
        _secret(settings).encode("utf-8"),
        encoded.encode("ascii"),
        sha256,
    ).hexdigest()
    if len(provided_mac) != len(expected_mac):
        return VerifyResult(ok=False, reason="bad-signature")
    if not hmac.compare_digest(provided_mac, expected_mac):
        return VerifyResult(ok=False, reason="bad-signature")
    try:
        json_bytes = _b64url_decode(encoded)
        raw = json.loads(json_bytes.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, base64.binascii.Error):
        return VerifyResult(ok=False, reason="malformed")
    if not isinstance(raw, dict):
        return VerifyResult(ok=False, reason="malformed")
    user_id_raw = raw.get("user_id")
    role = raw.get("role")
    status = raw.get("status")
    if not isinstance(user_id_raw, str):
        return VerifyResult(ok=False, reason="malformed")
    try:
        user_id = uuid.UUID(user_id_raw)
    except ValueError:
        return VerifyResult(ok=False, reason="malformed")
    if role not in ("volunteer", "admin"):
        return VerifyResult(ok=False, reason="malformed")
    if status not in ("pending", "active", "suspended"):
        return VerifyResult(ok=False, reason="malformed")
    iat = raw.get("iat")
    exp = raw.get("exp")
    if isinstance(exp, int):
        if int(time.time()) >= exp:
            return VerifyResult(ok=False, reason="expired")
    return VerifyResult(
        ok=True,
        payload=SessionPayload(
            user_id=user_id,
            role=role,
            status=status,
            iat=iat if isinstance(iat, int) else None,
            exp=exp if isinstance(exp, int) else None,
        ),
    )
