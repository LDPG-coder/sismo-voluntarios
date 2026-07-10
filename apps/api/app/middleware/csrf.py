"""CSRF middleware (double-submit cookie)."""

from __future__ import annotations

import hmac

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

from app.core.logging import get_logger

CSRF_COOKIE_NAME = "XSRF-TOKEN"
CSRF_HEADER_NAME = "X-CSRF-Token"
_WRITE_METHODS = frozenset({"POST", "PATCH", "PUT", "DELETE"})

_log = get_logger("app.middleware.csrf")


def _envelope(code: str, message: str, request_id: str) -> dict:
    return {"error": {"code": code, "message": message, "request_id": request_id}}


class CsrfMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.method not in _WRITE_METHODS:
            return await call_next(request)

        cookie_value = request.cookies.get(CSRF_COOKIE_NAME)
        if cookie_value is None:
            return await call_next(request)

        header_value = request.headers.get(CSRF_HEADER_NAME)
        if header_value is None:
            rid = getattr(request.state, "request_id", "")
            _log.warning("csrf.missing_header", path=request.url.path, request_id=rid)
            return JSONResponse(
                status_code=403,
                content=_envelope("auth.csrf_missing", f"X-CSRF-Token header required for {request.method}", rid),
            )

        if not hmac.compare_digest(cookie_value, header_value):
            rid = getattr(request.state, "request_id", "")
            _log.warning("csrf.mismatch", path=request.url.path, request_id=rid)
            return JSONResponse(
                status_code=403,
                content=_envelope("auth.csrf_invalid", "X-CSRF-Token does not match XSRF-TOKEN cookie", rid),
            )

        return await call_next(request)
