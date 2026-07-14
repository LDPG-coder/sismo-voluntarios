"""AI text formatting service: turns a raw proposal draft into clean markdown."""

from __future__ import annotations

from openai import OpenAI

from app.core.config import get_settings
from app.core.logging import get_logger

_log = get_logger("app.ai")

SYSTEM_PROMPT = (
    "Eres un editor de texto para una plataforma de voluntariado en Venezuela. "
    "Recibes un borrador escrito por una persona (posiblemente desordenado) y "
    "opcionalmente unas especificaciones sobre como quiere el resultado. "
    "Tu tarea es ORGANIZAR y DAR FORMATO al texto en Markdown limpio y legible. "
    "Responde SIEMPRE en espanol. "
    "REGLAS ESTRICTAS:\n"
    "- NO inventes informacion nueva ni datos que el borrador no contenga.\n"
    "- Conserva TODO el contenido del borrador; solo reorganiza, corrige "
    "ortografia y mejora la redaccion sin cambiar el significado.\n"
    "- Usa titulos (##, ###), negritas (**texto**), resaltados (==texto==), "
    "listas y parrafos donde ayuden a la claridad.\n"
    "- Si el borrador incluye imagenes en markdown (![...](...)), consérvalas "
    "y ubicalas en el lugar mas adecuado del texto.\n"
    "- Responde SOLO con el Markdown final, sin explicaciones, sin bloques de "
    "codigo, sin comillas alrededor."
)


def format_text(description: str, specs: str | None = None) -> str | None:
    settings = get_settings()
    if not settings.openai_api_key:
        _log.warning("ai.format.no_api_key")
        return None

    client = OpenAI(
        api_key=settings.openai_api_key,
        base_url="https://opencode.ai/zen/v1",
        timeout=30.0,
    )

    user_content = f"Borrador:\n{description}"
    if specs and specs.strip():
        user_content += f"\n\nEspecificaciones del resultado:\n{specs.strip()}"

    try:
        resp = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=4000,
            temperature=0.2,
        )

        content = (resp.choices[0].message.content or "").strip()
        if not content:
            reasoning = (resp.choices[0].message.reasoning_content or "").strip()
            content = reasoning

        content = content.strip()
        if content.startswith("```"):
            lines = content.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        if not content:
            _log.warning("ai.format.empty")
            return None

        return content
    except Exception as e:
        _log.exception("ai.format.error", error=str(e))
        return None
