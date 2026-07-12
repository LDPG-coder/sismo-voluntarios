"""CSRF middleware (double-submit cookie)."""

from __future__ import annotations

import hmac

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

from app.core.errors import error_response
from app.core.logging import get_logger
from app.pipeline.dependencies import SESSION_COOKIE_NAME

CSRF_COOKIE_NAME = "XSRF-TOKEN"
CSRF_HEADER_NAME = "X-CSRF-Token"
_WRITE_METHODS = frozenset({"POST", "PATCH", "PUT", "DELETE"})

_log = get_logger("app.middleware.csrf")


class CsrfMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.method not in _WRITE_METHODS:
            return await call_next(request)

        session_present = request.cookies.get(SESSION_COOKIE_NAME) is not None
        cookie_value = request.cookies.get(CSRF_COOKIE_NAME)
        header_value = request.headers.get(CSRF_HEADER_NAME)

        # Unauthenticated writes (e.g. the OAuth exchange / referral flows)
        # have no session yet, so CSRF is not applicable; downstream auth
        # dependencies still enforce authentication. The middleware only
        # enforces CSRF once a session cookie is present, which is exactly
        # the state a logged-in user reaches.
        if not session_present:
            return await call_next(request)

        if not cookie_value or not header_value:
            rid = getattr(request.state, "request_id", "")
            _log.warning("csrf.missing_token", path=request.url.path, request_id=rid)
            return JSONResponse(
                status_code=403,
                content=error_response(
                    code="auth.csrf_missing",
                    message="CSRF token required for authenticated writes",
                    request_id=rid,
                ),
            )

        if not hmac.compare_digest(cookie_value, header_value):
            rid = getattr(request.state, "request_id", "")
            _log.warning("csrf.mismatch", path=request.url.path, request_id=rid)
            return JSONResponse(
                status_code=403,
                content=error_response(code="auth.csrf_invalid", message="X-CSRF-Token does not match XSRF-TOKEN cookie", request_id=rid),
            )

        return await call_next(request)
