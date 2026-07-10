"""Rate-limit middleware."""

from __future__ import annotations

import threading
import time
from collections import deque

from app.core.config import get_settings
from app.core.logging import get_logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

log = get_logger("app.middleware.rate_limit")


def _get_remote_address(request: Request) -> str:
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

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.method == "OPTIONS":
            return await call_next(request)
        if request.headers.get("X-Idempotency-Replay") == "true":
            return await call_next(request)

        bucket, key, per_minute, burst = _bucket_for(request)
        if per_minute <= 0:
            return await call_next(request)

        counter_name = f"{bucket}:{key}"
        counter = self._counter(counter_name, limit=per_minute, burst=burst)
        accepted, retry_after, remaining = counter.hit(time.monotonic())
        if not accepted:
            rid = getattr(request.state, "request_id", "")
            log.warning("rate_limit.exceeded", bucket=bucket, path=request.url.path)
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "rate_limit.exceeded",
                        "message": f"rate limit exceeded for {bucket} bucket",
                        "request_id": rid,
                        "details": {"retry_after": retry_after, "limit_per_minute": per_minute},
                    }
                },
                headers={"Retry-After": str(retry_after), "X-Request-Id": rid},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(per_minute + burst)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
