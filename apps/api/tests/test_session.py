"""Unit tests for session signing (jti) and server-side revocation (D1)."""

import base64
import hashlib
import hmac
import json
import time
from uuid import uuid4

from app.core.config import get_settings
from app.pipeline.session import SessionPayload, decode_session, encode_session
from app.pipeline.session_store import is_revoked, revoke_session


def _forge(secret: str, claims: dict) -> str:
    body = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    mac = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{mac}"


def test_encode_decode_roundtrip_includes_jti():
    settings = get_settings()
    user_id = uuid4()
    payload = SessionPayload(
        user_id=user_id, role="volunteer", status="active", jti="jti-abc"
    )
    token = encode_session(settings, payload)
    result = decode_session(settings, token)
    assert result.ok
    assert result.payload.user_id == user_id
    assert result.payload.jti == "jti-abc"
    assert result.payload.role == "volunteer"


def test_decode_rejects_tampered_signature():
    settings = get_settings()
    token = encode_session(
        settings, SessionPayload(user_id=uuid4(), role="volunteer", status="active")
    )
    bad = token[:-2] + ("ab" if token[-1] != "ab" else "cd")
    result = decode_session(settings, bad)
    assert result.ok is False
    assert result.reason == "bad-signature"


def test_decode_rejects_expired():
    settings = get_settings()
    secret = settings.session_secret or "dev-only-session-secret-do-not-use-in-production"
    claims = {
        "user_id": str(uuid4()),
        "role": "volunteer",
        "status": "active",
        "iat": int(time.time()) - 100,
        "exp": int(time.time()) - 10,
        "jti": "expired-jti",
    }
    result = decode_session(settings, _forge(secret, claims))
    assert result.ok is False
    assert result.reason == "expired"


def test_decode_rejects_missing_and_malformed():
    settings = get_settings()
    assert decode_session(settings, None).ok is False
    assert decode_session(settings, "not.a.token").ok is False


def test_revocation_store():
    revoke_session("jti-store-test", 60)
    assert is_revoked("jti-store-test") is True
    assert is_revoked("jti-store-unknown") is False
