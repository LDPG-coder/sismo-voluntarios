"""Structured logging."""

from __future__ import annotations

import logging
import sys
from contextvars import ContextVar
from typing import Any

import structlog

from app.core.config import get_settings

_request_id_var: ContextVar[str | None] = ContextVar("sismo_request_id", default=None)


def bind_request_id(request_id: str) -> None:
    _request_id_var.set(request_id)


def clear_request_id() -> None:
    _request_id_var.set(None)


def get_request_id() -> str | None:
    return _request_id_var.get()


def _add_request_id(_logger: Any, _method: str, event_dict: dict) -> dict:
    rid = _request_id_var.get()
    if rid is not None:
        event_dict.setdefault("request_id", rid)
    return event_dict


def _drop_color_message_key(_logger: Any, _method: str, event_dict: dict) -> dict:
    event_dict.pop("color_message", None)
    return event_dict


def configure_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    json_mode = settings.log_format == "json" or settings.env == "production"

    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        _drop_color_message_key,
        _add_request_id,
        timestamper,
    ]

    if json_mode:
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=False)

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    for noisy in ("uvicorn.access", "uvicorn.error"):
        logging.getLogger(noisy).setLevel(level)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    if name is None:
        return structlog.get_logger()
    return structlog.get_logger(name)
