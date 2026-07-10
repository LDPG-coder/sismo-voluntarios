"""AI suggestion service using plain JSON response."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from openai import OpenAI

from app.core.config import get_settings
from app.core.logging import get_logger

_log = get_logger("app.ai")

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


def suggest_activity(description: str) -> ActivitySuggestion | None:
    settings = get_settings()
    if not settings.openai_api_key:
        _log.warning("ai.suggest.no_api_key")
        return None

    client = OpenAI(
        api_key=settings.openai_api_key,
        base_url="https://opencode.ai/zen/v1",
        timeout=15.0,
    )

    now_venezuela = datetime.now(timezone(timedelta(hours=-4)))
    now_str = now_venezuela.strftime("%A %d/%m/%Y %H:%M (hora de Venezuela, UTC-4)")

    try:
        resp = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Hoy es {now_str}.\n\nDescripcion de actividad:\n{description}"},
            ],
            max_tokens=2000,
            temperature=0.1,
        )

        content = (resp.choices[0].message.content or "").strip()
        reasoning = (resp.choices[0].message.reasoning_content or "").strip()
        _log.info("ai.suggest.raw_content", content=content[:500], reasoning=reasoning[:200])

        args = _extract_json(content) or _extract_json(reasoning)
        if not args:
            _log.warning("ai.suggest.no_json", content=content[:500])
            return None

        return ActivitySuggestion(
            title=args.get("title", ""),
            zone=args.get("zone", ZONES[0]),
            raw_address=args.get("raw_address", ""),
            date_time=args.get("date_time_suggestion"),
            end_time=args.get("end_time_suggestion"),
            estimated_duration_min=args.get("estimated_duration_min"),
            max_participants=args.get("max_participants"),
            requirements=args.get("requirements", []),
        )
    except Exception as e:
        _log.exception("ai.suggest.error", error=str(e))
        return None
