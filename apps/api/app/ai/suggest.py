"""AI suggestion service using plain JSON response."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from openai import OpenAI

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.utils import format_venezuela_now

_log = get_logger("app.ai")

ZONES = ["Caracas", "Guatire", "Guarenas", "La Guaira", "Altos Mirandinos", "Caucagua"]

SYSTEM_PROMPT = (
    "Eres un asistente de voluntariado para una plataforma en Venezuela. "
    "Toda la informacion, direcciones, zonas y referencias son de Venezuela. "
    "Responde SIEMPRE en espanol. "
    "Responde SOLO JSON valido (sin markdown, sin texto extra) y con TODAS las claves presentes. "
    "El usuario escribe la descripcion poco a poco: en cada respuesta completa UNICAMENTE "
    "los campos para los que la descripcion ya aporta informacion clara. "
    "Si para un campo no hay informacion en la descripcion, dejalo vacio "
    "(null para objetos, \"\" para texto, [] para listas). "
    "NO inventes ni supongas datos que el usuario no haya escrito. "
    "Si menciona fechas relativas ('mañana', 'el lunes'), calcula con la fecha actual provista. "
    "En 'requirements' incluye SOLO lo que el usuario pida explicitamente "
    "(materiales, condiciones, edad, etc.); si no menciona nada, usa [].\n"
    '{"title":"max 60 chars o null","zone":"Caracas|Guatire|Guarenas|La Guaira|Altos Mirandinos|Caucagua o null",'
    '"raw_address":"direccion en Venezuela o null","date_time_suggestion":"ISO 8601 o null",'
    '"end_time_suggestion":"ISO 8601 o null","estimated_duration_min":minutos o null,'
    '"max_participants":num o null,'
    '"contact_info":"medio de contacto para coordinar o null",'
    '"requirements":["item"]}'
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
    contact_info: str | None
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

    now_str, _ = format_venezuela_now(settings.timezone_offset_hours)

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
            raw_address=" ".join(args.get("raw_address", "")) if isinstance(args.get("raw_address"), list) else args.get("raw_address", ""),
            date_time=args.get("date_time_suggestion"),
            end_time=args.get("end_time_suggestion"),
            estimated_duration_min=args.get("estimated_duration_min"),
            max_participants=args.get("max_participants"),
            contact_info=" ".join(args.get("contact_info", "")) if isinstance(args.get("contact_info"), list) else args.get("contact_info"),
            requirements=args.get("requirements", []),
        )
    except Exception as e:
        _log.exception("ai.suggest.error", error=str(e))
        return None
