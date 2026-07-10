"""AI suggestion service with streaming support."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from typing import Generator

from openai import OpenAI

from app.core.config import get_settings
from app.core.logging import get_logger

_log = get_logger("app.ai.stream")

ZONES = ["Caracas", "Guatire", "Guarenas", "La Guaira", "Altos Mirandinos", "Caucagua"]

SYSTEM_PROMPT = (
    "Eres un asistente de voluntariado para una plataforma en Venezuela. "
    "Toda la informacion, direcciones, zonas y referencias son de Venezuela. "
    "Responde SIEMPRE en espanol. "
    "Responde SOLO JSON valido (sin markdown, sin texto extra). "
    "Si falta info, haz suposicion razonable basada en contexto venezolano. "
    "Si menciona fechas relativas ('mañana', 'el lunes'), calcula con la fecha actual provista.\n"
    '{"title":"max 60 chars","zone":"Caracas|Guatire|Guarenas|La Guaira|Altos Mirandinos|Caucagua",'
    '"raw_address":"direccion en Venezuela","date_time_suggestion":"ISO 8601 o null",'
    '"end_time_suggestion":"ISO 8601 o null","estimated_duration_min":minutos o null,'
    '"max_participants":num o null,"requirements":["item"]}'
)


@dataclass
class ActivitySuggestion:
    title: str
    zone: str
    raw_address: str
    date_time: str | None
    end_time: str | None
    estimated_duration_min: int | None
    max_participants: int | None
    requirements: list[str]


def _extract_json(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("{"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


def suggest_activity_stream(description: str) -> Generator[dict, None, None]:
    """Yields SSE events as the AI generates a response.

    Event types:
      - thinking: reasoning content chunk
      - chunk: content chunk (the actual JSON being built)
      - result: final parsed suggestion
      - error: something went wrong
    """
    settings = get_settings()
    if not settings.openai_api_key:
        yield {"event": "error", "data": json.dumps({"code": "no_api_key", "message": "AI not configured"})}
        return

    client = OpenAI(
        api_key=settings.openai_api_key,
        base_url="https://opencode.ai/zen/v1",
        timeout=30.0,
    )

    now_venezuela = datetime.now(timezone(timedelta(hours=-4)))
    now_str = now_venezuela.strftime("%A %d de %B de %Y, %H:%M (hora de Venezuela, UTC-4)")

    try:
        stream = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Hoy es {now_str}.\n\nDescripcion de actividad:\n{description}"},
            ],
            max_tokens=2000,
            temperature=0.1,
            stream=True,
        )

        full_content = ""
        full_reasoning = ""

        for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if not delta:
                continue

            # Stream reasoning chunks
            reasoning = getattr(delta, "reasoning_content", None) or ""
            if reasoning:
                full_reasoning += reasoning
                yield {"event": "thinking", "data": reasoning}

            # Stream content chunks (the JSON)
            content = delta.content or ""
            if content:
                full_content += content
                yield {"event": "chunk", "data": content}

            # Check for finish
            finish = chunk.choices[0].finish_reason if chunk.choices else None
            if finish == "length":
                _log.warning("ai.suggest.stream.length", reasoning_len=len(full_reasoning), content_len=len(full_content))

        # Try to parse the result
        args = _extract_json(full_content) or _extract_json(full_reasoning)
        if args:
            result = ActivitySuggestion(
                title=args.get("title", ""),
                zone=args.get("zone", ZONES[0]),
                raw_address=" ".join(args.get("raw_address", "")) if isinstance(args.get("raw_address"), list) else args.get("raw_address", ""),
                date_time=args.get("date_time_suggestion"),
                end_time=args.get("end_time_suggestion"),
                estimated_duration_min=args.get("estimated_duration_min"),
                max_participants=args.get("max_participants"),
                requirements=args.get("requirements", []),
            )
            _log.info("ai.suggest.stream.success", content_len=len(full_content))
            yield {"event": "result", "data": json.dumps(asdict(result))}
        else:
            _log.warning("ai.suggest.stream.no_json", content=full_content[:200])
            yield {"event": "error", "data": json.dumps({"code": "no_json", "message": "No se pudo generar sugerencia"})}

    except Exception as e:
        _log.exception("ai.suggest.stream.error", error=str(e))
        yield {"event": "error", "data": json.dumps({"code": "stream_error", "message": str(e)})}
