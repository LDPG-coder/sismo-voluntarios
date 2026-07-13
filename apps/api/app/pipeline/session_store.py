"""Server-side session revocation store (Redis-backed denylist).

Sessions are stateless signed cookies. To support real server-side logout
(and, later, global revocation), each session carries an opaque ``jti``.
Logging out marks that ``jti`` here with a TTL equal to the cookie's
remaining lifetime. ``require_session`` rejects any session whose ``jti``
is present in the denylist.

Fails open: if Redis is unavailable the check is skipped so we never lock
everyone out, at the cost of logout not taking effect while Redis is down.
"""

from __future__ import annotations

import json
import secrets
import threading
import time

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("app.pipeline.session_store")

try:
    import redis  # sync client

    _REDIS_AVAILABLE = True
except Exception:  # pragma: no cover - redis is a hard dependency
    redis = None  # type: ignore[assignment]
    _REDIS_AVAILABLE = False

_REVOKED_PREFIX = "session:revoked:"
# Avoid a Redis round-trip on every authenticated request by caching the
# last known revocation state per jti for a short window. A 2s staleness
# is acceptable: logout is user-initiated and the cookie is also deleted
# client-side immediately.
_CACHE_TTL = 2.0

_client: "redis.Redis | None" = None
_client_lock = threading.Lock()
_cache: dict[str, tuple[bool, float]] = {}
_cache_lock = threading.Lock()


def _get_client() -> "redis.Redis | None":
    global _client
    if not _REDIS_AVAILABLE:
        return None
    if _client is not None:
        return _client
    with _client_lock:
        if _client is not None:
            return _client
        try:
            settings = get_settings()
            client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            client.ping()
            _client = client
        except Exception:
            log.warning("session_store.redis_unavailable")
            _client = None
        return _client


def revoke_session(jti: str, ttl_seconds: int) -> None:
    """Mark a session id as revoked for the remainder of its lifetime."""
    if not jti or ttl_seconds <= 0:
        return
    client = _get_client()
    try:
        if client is not None:
            client.set(_REVOKED_PREFIX + jti, "1", ex=int(ttl_seconds))
    except Exception:
        log.warning("session_store.revoke_failed", jti=jti)
    with _cache_lock:
        _cache[jti] = (True, time.monotonic() + _CACHE_TTL)


def is_revoked(jti: str) -> bool:
    """Return True if the session id has been revoked."""
    if not jti:
        return False
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(jti)
        if cached is not None and cached[1] > now:
            return cached[0]
    revoked = False
    client = _get_client()
    if client is not None:
        try:
            revoked = client.get(_REVOKED_PREFIX + jti) is not None
        except Exception:
            revoked = False
    with _cache_lock:
        _cache[jti] = (revoked, now + _CACHE_TTL)
    return revoked


# -- Refresh tokens -------------------------------------------------------
#
# A refresh token is an opaque random id (the cookie value). The server stores
# its payload in Redis keyed by that id, with a TTL equal to the refresh
# lifetime. Each use rotates the id (the old one is deleted). All refresh
# tokens for a user share a `family`; bumping the family (e.g. on logout-
# everywhere or a role/status change) invalidates every outstanding token at
# once without scanning them.

_REFRESH_PREFIX = "session:refresh:"
_FAMILY_PREFIX = "session:user-family:"


def _family_key(user_id: str) -> str:
    return f"{_FAMILY_PREFIX}{user_id}"


def _get_family(user_id: str) -> str:
    client = _get_client()
    if client is None:
        return "default"
    try:
        fam = client.get(_family_key(user_id))
        if fam:
            return fam
        fam = secrets.token_hex(16)
        client.set(_family_key(user_id), fam)
        return fam
    except Exception:
        return "default"


def issue_refresh(user_id: str, role: str, status: str) -> str:
    """Create and store a new refresh token, returning its opaque id."""
    settings = get_settings()
    rid = secrets.token_urlsafe(32)
    family = _get_family(user_id)
    payload = {
        "user_id": str(user_id),
        "role": role,
        "status": status,
        "family": family,
        "exp": int(time.time()) + settings.session_refresh_max_age_seconds,
    }
    client = _get_client()
    if client is not None:
        try:
            client.set(
                _REFRESH_PREFIX + rid,
                json.dumps(payload),
                ex=settings.session_refresh_max_age_seconds,
            )
        except Exception:
            log.warning("session_store.refresh_store_failed", user_id=user_id)
    return rid


def consume_refresh(rid: str) -> dict | None:
    """Validate and rotate a refresh token.

    Returns the stored payload (with current DB-derived fields to be
    re-checked by the caller) or None if invalid/expired/revoked. On success
    the consumed id is deleted so it cannot be reused.
    """
    client = _get_client()
    if client is None or not rid:
        return None
    try:
        raw = client.get(_REFRESH_PREFIX + rid)
    except Exception:
        return None
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except Exception:
        return None
    try:
        client.delete(_REFRESH_PREFIX + rid)
    except Exception:
        pass
    if isinstance(payload.get("exp"), int) and int(time.time()) >= payload["exp"]:
        return None
    current = _get_family(payload.get("user_id", ""))
    if payload.get("family") != current:
        return None
    return payload


def revoke_refresh(rid: str) -> None:
    client = _get_client()
    if client is None or not rid:
        return
    try:
        client.delete(_REFRESH_PREFIX + rid)
    except Exception:
        pass


def revoke_user_sessions(user_id: str) -> None:
    """Invalidate every refresh token for a user (logout-everywhere, or after
    a role/status change) by rotating the family id."""
    client = _get_client()
    if client is None:
        return
    try:
        client.set(_family_key(user_id), secrets.token_hex(16))
    except Exception:
        log.warning("session_store.family_rotate_failed", user_id=user_id)
