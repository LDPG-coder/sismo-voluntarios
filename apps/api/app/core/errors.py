"""Stable error code registry and global exception handlers."""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from enum import StrEnum

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import bind_request_id, clear_request_id, get_logger

_log = get_logger("app.errors")


class ErrorCode(StrEnum):
    auth_unauthenticated = "auth.unauthenticated"
    auth_forbidden = "auth.forbidden"
    auth_csrf_missing = "auth.csrf_missing"
    auth_csrf_invalid = "auth.csrf_invalid"
    auth_oauth_not_configured = "auth.oauth_not_configured"
    auth_oauth_state_invalid = "auth.oauth_state_invalid"
    auth_oauth_code_invalid = "auth.oauth_code_invalid"
    auth_oauth_token_exchange_failed = "auth.oauth_token_exchange_failed"
    auth_oauth_id_token_invalid = "auth.oauth_id_token_invalid"
    auth_not_invited = "auth.not_invited"
    auth_sep_token_invalid = "auth.sep_token_invalid"
    auth_sep_unauthorized = "auth.sep_unauthorized"
    auth_session_revoked = "auth.session_revoked"
    auth_session_expired = "auth.session_expired"

    activity_not_found = "activity.not_found"
    activity_full = "activity.full"
    activity_already_joined = "activity.already_joined"
    activity_not_member = "activity.not_member"
    activity_not_creator = "activity.not_creator"
    activity_cancelled = "activity.cancelled"

    user_not_found = "user.not_found"
    user_email_exists = "user.email_exists"
    referral_invalid = "referral.invalid"

    validation_missing_field = "validation.missing_field"
    validation_invalid_format = "validation.invalid_format"

    worker_unauthorized = "worker.unauthorized"
    rate_limit_exceeded = "rate_limit.exceeded"
    idempotency_conflict = "idempotency.conflict"
    idempotency_missing = "idempotency.missing"
    not_found = "not_found"
    internal_unexpected = "internal.unexpected"


_DEFAULT_STATUS: dict[ErrorCode, int] = {
    ErrorCode.auth_unauthenticated: 401,
    ErrorCode.auth_forbidden: 403,
    ErrorCode.auth_csrf_missing: 403,
    ErrorCode.auth_csrf_invalid: 403,
    ErrorCode.auth_oauth_not_configured: 503,
    ErrorCode.auth_oauth_state_invalid: 400,
    ErrorCode.auth_oauth_code_invalid: 400,
    ErrorCode.auth_oauth_token_exchange_failed: 502,
    ErrorCode.auth_oauth_id_token_invalid: 401,
    ErrorCode.auth_not_invited: 403,
    ErrorCode.auth_sep_token_invalid: 401,
    ErrorCode.auth_sep_unauthorized: 401,
    ErrorCode.auth_session_revoked: 401,
    ErrorCode.auth_session_expired: 401,
    ErrorCode.activity_not_found: 404,
    ErrorCode.not_found: 404,
    ErrorCode.activity_full: 409,
    ErrorCode.activity_already_joined: 409,
    ErrorCode.activity_not_member: 404,
    ErrorCode.activity_not_creator: 403,
    ErrorCode.activity_cancelled: 410,
    ErrorCode.user_not_found: 404,
    ErrorCode.user_email_exists: 409,
    ErrorCode.referral_invalid: 400,
    ErrorCode.validation_missing_field: 422,
    ErrorCode.validation_invalid_format: 422,
    ErrorCode.worker_unauthorized: 401,
    ErrorCode.rate_limit_exceeded: 429,
    ErrorCode.idempotency_conflict: 409,
    ErrorCode.idempotency_missing: 400,
    ErrorCode.internal_unexpected: 500,
}


class ApiError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        http_status: int | None = None,
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status or _DEFAULT_STATUS[code]
        self.details = details


def _request_id(request: Request) -> str:
    rid = getattr(request.state, "request_id", None)
    if rid:
        return rid
    rid = f"req-{uuid.uuid4().hex[:12]}"
    request.state.request_id = rid
    return rid


def request_id_from_request(request: Request) -> str:
    return _request_id(request)


def _envelope(
    *,
    code: ErrorCode | str,
    message: str,
    request_id: str,
    details: dict | None = None,
) -> dict:
    code_value = code.value if isinstance(code, ErrorCode) else code
    body: dict = {"error": {"code": code_value, "message": message, "request_id": request_id}}
    if details is not None:
        body["error"]["details"] = details
    return body


def error_response(
    *,
    code: ErrorCode | str,
    message: str,
    request_id: str,
    details: dict | None = None,
) -> dict:
    return _envelope(code=code, message=message, request_id=request_id, details=details)


async def _api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    rid = _request_id(request)
    return JSONResponse(
        status_code=exc.http_status,
        content=_envelope(code=exc.code, message=exc.message, request_id=rid, details=exc.details),
        headers={"X-Request-Id": rid},
    )


async def _http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    rid = _request_id(request)
    code = _classify_http_exception(exc)
    message = exc.detail if isinstance(exc.detail, str) else "request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=_envelope(code=code, message=message, request_id=rid),
        headers={"X-Request-Id": rid},
    )


def _classify_http_exception(exc: StarletteHTTPException) -> ErrorCode:
    if exc.status_code == 401:
        return ErrorCode.auth_unauthenticated
    if exc.status_code == 403:
        return ErrorCode.auth_forbidden
    if exc.status_code == 404:
        return ErrorCode.not_found
    if exc.status_code == 422:
        return ErrorCode.validation_invalid_format
    if exc.status_code == 429:
        return ErrorCode.rate_limit_exceeded
    return ErrorCode.internal_unexpected


async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    rid = _request_id(request)
    errors = exc.errors()
    missing = [e for e in errors if e.get("type") in ("missing", "value_error.missing")]
    code = ErrorCode.validation_missing_field if missing else ErrorCode.validation_invalid_format
    first = errors[0] if errors else {"msg": "validation error"}
    loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    message = (
        f"{loc}: {first.get('msg', 'validation error')}" if loc else first.get("msg", "validation error")
    )
    return JSONResponse(
        status_code=422,
        content=_envelope(code=code, message=message, request_id=rid, details={"errors": errors}),
        headers={"X-Request-Id": rid},
    )


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    rid = _request_id(request)
    _log.exception("unhandled.exception", exc_info=exc, path=request.url.path, method=request.method)
    return JSONResponse(
        status_code=500,
        content=_envelope(code=ErrorCode.internal_unexpected, message="internal server error", request_id=rid),
        headers={"X-Request-Id": rid},
    )


async def request_id_middleware(request: Request, call_next: Callable[[Request], Awaitable]):
    incoming = request.headers.get("X-Request-Id")
    rid = incoming.strip() if incoming and incoming.strip() else f"req-{uuid.uuid4().hex[:12]}"
    if len(rid) > 64:
        rid = rid[:64]
    request.state.request_id = rid
    bind_request_id(rid)
    try:
        response = await call_next(request)
    finally:
        clear_request_id()
    response.headers["X-Request-Id"] = rid
    return response


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(Exception, _unhandled_handler)
    app.middleware("http")(request_id_middleware)
