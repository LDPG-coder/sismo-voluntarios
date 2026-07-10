"""AI suggestion endpoints with per-user Redis rate limiting."""

from __future__ import annotations

import json
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.ai.suggest import ActivitySuggestion, suggest_activity
from app.ai.suggest_stream import suggest_activity_stream
from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.pipeline.dependencies import require_session
from app.db.models import User

_log = get_logger("app.api.ai")
router = APIRouter(prefix="/ai", tags=["ai"])

_redis: aioredis.Redis | None = None


async def _get_redis(settings: Annotated[Settings, Depends(get_settings)]) -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


class SuggestRequest(BaseModel):
    description: str = Field(..., min_length=10, max_length=2000)


class SuggestResponse(BaseModel):
    title: str
    zone: str
    raw_address: str
    date_time: str | None = None
    end_time: str | None = None
    estimated_duration_min: int | None = None
    max_participants: int | None = None
    contact_info: str | None = None
    requirements: list[str] = []


@router.post("/suggest", response_model=SuggestResponse)
async def ai_suggest(
    body: SuggestRequest,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    redis: Annotated[aioredis.Redis, Depends(_get_redis)],
    user: Annotated[User, Depends(require_session)],
) -> SuggestResponse:
    user_id = user.id
    rate_key = f"ai_suggest:{user_id}"
    limit = settings.ai_rate_limit_per_user_per_hour

    current = await redis.incr(rate_key)
    if current == 1:
        await redis.expire(rate_key, 3600)

    if current > limit:
        ttl = await redis.ttl(rate_key)
        raise ApiError(
            ErrorCode.rate_limit_exceeded,
            f"Limite de {limit} sugerencias por hora alcanzado. Intenta en {ttl} minutos.",
        )

    result = suggest_activity(body.description)
    if result is None:
        raise ApiError(ErrorCode.internal_unexpected, "No se pudo generar sugerencia. Intenta de nuevo.")

    _log.info("ai.suggest.success", user_id=user_id, remaining=limit - current)
    return SuggestResponse(
        title=result.title,
        zone=result.zone,
        raw_address=result.raw_address,
        date_time=result.date_time,
        end_time=result.end_time,
        estimated_duration_min=result.estimated_duration_min,
        max_participants=result.max_participants,
        contact_info=result.contact_info,
        requirements=result.requirements,
    )


@router.post("/suggest/stream")
async def ai_suggest_stream(
    body: SuggestRequest,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    redis: Annotated[aioredis.Redis, Depends(_get_redis)],
    user: Annotated[User, Depends(require_session)],
) -> StreamingResponse:
    user_id = user.id
    rate_key = f"ai_suggest:{user_id}"
    limit = settings.ai_rate_limit_per_user_per_hour

    current = await redis.incr(rate_key)
    if current == 1:
        await redis.expire(rate_key, 3600)

    if current > limit:
        ttl = await redis.ttl(rate_key)
        raise ApiError(
            ErrorCode.rate_limit_exceeded,
            f"Limite de {limit} sugerencias por hora alcanzado. Intenta en {ttl} minutos.",
        )

    def generate():
        for event in suggest_activity_stream(body.description):
            event_type = event["event"]
            data = event["data"]
            yield f"event: {event_type}\ndata: {data}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
