"""Rate-limit middleware.

Limits requests per client IP using a sliding/fixed window counter. The
counter is stored in Redis when available (shared across workers/instances)
and falls back to an in-process counter otherwise.

Security notes:
- Client-supplied IP headers (``X-Forwarded-For`` / ``CF-Connecting-IP``) are
  only honored when ``SISMO_RATE_LIMIT_TRUST_PROXY=true`` (i.e. the API sits
  behind a trusted proxy that overwrites those headers). Otherwise the peer
  socket address is used so attackers cannot rotate headers to dodge limits.
- The previous ``X-Idempotency-Replay: true`` header bypass has been removed;
  rate limiting is always applied to state-changing and read traffic.
"""

from __future__ import annotations

import threading
import time
from collections import deque

from app.core.config import get_settings
from app.core.errors import error_response
from app.core.logging import get_logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

log = get_logger("app.middleware.rate_limit")

try:
    import redis.asyncio as redis_async

    _REDIS_AVAILABLE = True
except Exception:  # pragma: no cover - redis is a hard dependency
    redis_async = None
    _REDIS_AVAILABLE = False


def _get_remote_address(request: Request) -> str:
    settings = get_settings()
    if settings.rate_limit_trust_proxy:
        cf = request.headers.get("CF-Connecting-IP")
        if cf:
            return cf.strip()
        fwd = request.headers.get("X-Forwarded-For")
        if fwd:
            return fwd.split(",")[0].strip()
    if request.client is None:
        return "unknown"
    return request.client.host


def _bucket_for(request: Request) -> tuple[str, str, int, int]:
    settings = get_settings()
    path = request.url.path
    if path.startswith("/api/v1/auth"):
        return ("auth", _get_remote_address(request), settings.rate_limit_auth_per_min, 0)
    if path.startswith("/api/v1/ai"):
        # El autocompletado con IA dispara una peticion por cada pausa de
        # escritura, por lo que necesita un tope de corto plazo mas generoso
        # para no cortar las consultas frecuentes del usuario.
        return (
            "ai",
            _get_remote_address(request),
            settings.ai_rate_limit_per_min,
            settings.ai_rate_limit_burst,
        )
    return (
        "public",
        _get_remote_address(request),
        settings.rate_limit_public_per_min,
        settings.rate_limit_burst,
    )


class _WindowCounter:
    __slots__ = ("_deque", "_lock", "_limit", "_burst", "_window_s")

    def __init__(self, *, limit: int, burst: int, window_s: int = 60) -> None:
        self._limit = limit
        self._burst = burst
        self._window_s = window_s
        self._deque: deque[float] = deque()
        self._lock = threading.Lock()

    def hit(self, now: float) -> tuple[bool, int, int]:
        cap = self._limit + self._burst
        cutoff = now - self._window_s
        with self._lock:
            while self._deque and self._deque[0] <= cutoff:
                self._deque.popleft()
            if len(self._deque) >= cap:
                retry = max(1, int(self._window_s - (now - self._deque[0])) + 1)
                return False, retry, 0
            self._deque.append(now)
            remaining = max(0, cap - len(self._deque))
            return True, 0, remaining


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._counters: dict[str, _WindowCounter] = {}
        self._counters_lock = threading.Lock()
        self._redis: "redis_async.Redis | None" = None
        self._redis_tried = False

    def _counter(self, name: str, *, limit: int, burst: int) -> _WindowCounter:
        existing = self._counters.get(name)
        if existing is not None:
            return existing
        with self._counters_lock:
            existing = self._counters.get(name)
            if existing is not None:
                return existing
            counter = _WindowCounter(limit=limit, burst=burst)
            self._counters[name] = counter
            return counter

    def _get_redis(self) -> "redis_async.Redis | None":
        if not _REDIS_AVAILABLE:
            return None
        if self._redis_tried:
            return self._redis
        self._redis_tried = True
        try:
            settings = get_settings()
            self._redis = redis_async.from_url(settings.redis_url, decode_responses=True)
        except Exception:
            self._redis = None
            log.warning("rate_limit.redis_unavailable", url=get_settings().redis_url)
        return self._redis

    async def _redis_hit(self, bucket: str, key: str, per_minute: int, burst: int) -> tuple[bool, int, int]:
        r = self._get_redis()
        if r is None:
            return self._memory_hit(bucket, key, per_minute, burst)
        cap = per_minute + burst
        rk = f"ratelimit:{bucket}:{key}"
        try:
            pipe = r.pipeline()
            await pipe.incr(rk)
            await pipe.expire(rk, 60, nx=True)
            results = await pipe.execute()
            count = results[0]
            if count > cap:
                ttl = await r.ttl(rk)
                retry = max(1, ttl) if ttl and ttl > 0 else 60
                return False, retry, max(0, cap - count)
            remaining = max(0, cap - count)
            return True, 0, remaining
        except Exception:
            log.warning("rate_limit.redis_error_fallback")
            return self._memory_hit(bucket, key, per_minute, burst)

    def _memory_hit(self, bucket: str, key: str, per_minute: int, burst: int) -> tuple[bool, int, int]:
        counter = self._counter(f"{bucket}:{key}", limit=per_minute, burst=burst)
        return counter.hit(time.monotonic())

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.method == "OPTIONS":
            return await call_next(request)

        bucket, key, per_minute, burst = _bucket_for(request)
        if per_minute <= 0:
            return await call_next(request)

        accepted, retry_after, remaining = await self._redis_hit(bucket, key, per_minute, burst)
        if not accepted:
            rid = getattr(request.state, "request_id", "")
            log.warning("rate_limit.exceeded", bucket=bucket, path=request.url.path)
            return JSONResponse(
                status_code=429,
                content=error_response(
                    code="rate_limit.exceeded",
                    message=f"rate limit exceeded for {bucket} bucket",
                    request_id=rid,
                    details={"retry_after": retry_after, "limit_per_minute": per_minute},
                ),
                headers={"Retry-After": str(retry_after), "X-Request-Id": rid},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(per_minute + burst)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
