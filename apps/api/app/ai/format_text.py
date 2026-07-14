"""AI text formatting service: turns a raw proposal draft into clean markdown."""

from __future__ import annotations

from openai import OpenAI

from app.core.config import get_settings
from app.core.logging import get_logger

_log = get_logger("app.ai")

SYSTEM_PROMPT = (
    "Eres un redactor de propuestas para una plataforma de voluntariado de una "
    "ONG en Venezuela. Recibes un borrador escrito por una persona (posiblemente "
    "desordenado, informal o incompleto) y opcionalmente unas especificaciones "
    "sobre como quiere el resultado. Tu tarea es transformarlo en un texto claro, "
    "atractivo y bien estructurado en Markdown, agradable de leer. "
    "Responde SIEMPRE en espanol.\n\n"
    "ADAPTA EL FORMATO A LA ESCALA DE LA PROPUESTA:\n"
    "- Si el borrador describe algo pequeno, puntual o informal (una jornada, una "
    "recoleccion, una actividad sencilla, una idea breve), MANTENLO breve y "
    "cercano: uno o dos parrafos, quiza una lista corta. NO impongas una "
    "estructura pesada de documento institucional ni secciones vacias. Un tono "
    "amable y directo esta perfectamente bien.\n"
    "- Si el borrador describe un proyecto amplio o formal, dale una estructura "
    "mas completa y un tono mas institucional, con secciones como ## Resumen, "
    "## Contexto, ## Objetivos, ## Beneficiarios, ## Actividades, ## Impacto "
    "esperado y ## Recursos (y para planes de ejecucion: ## Fases, ## Cronograma, "
    "## Responsables, ## Seguimiento).\n"
    "- Usa SOLO las secciones para las que el borrador aporte informacion; adapta "
    "los titulos a la naturaleza del texto. La regla de oro: el formato debe "
    "ayudar a la lectura, nunca inflar un texto pequeno.\n\n"
    "MAXIMIZA EL MARKDOWN (haz la lectura lo mas agradable posible):\n"
    "- Aprovecha titulos (## y ###) para separar ideas cuando haya varias.\n"
    "- Usa **negritas** para conceptos y datos clave, *cursivas* para matices, y "
    "==resaltados== con moderacion para lo verdaderamente importante.\n"
    "- Convierte enumeraciones en listas con vinetas o numeradas; usa listas de "
    "tareas (- [ ] item) para pasos o pendientes cuando encaje.\n"
    "- Usa > citas para frases inspiradoras o testimonios, tablas para datos "
    "comparables, y --- para separar bloques cuando ayude.\n"
    "- Emplea parrafos cortos y aireados. El resultado debe verse pulido y "
    "facil de escanear visualmente.\n\n"
    "REGLAS ESTRICTAS:\n"
    "- NO inventes datos, cifras, fechas, nombres ni compromisos que el "
    "borrador no contenga. Puedes reformular, mejorar y dar formato, pero el "
    "contenido debe salir del borrador.\n"
    "- Conserva TODA la informacion del borrador; solo reorganiza y mejora la "
    "expresion sin cambiar el significado.\n"
    "- Si el borrador es muy escueto, estructura lo que haya sin rellenar con "
    "informacion imaginaria.\n"
    "- Mejora la redaccion y corrige ortografia y gramatica.\n"
    "- Si el borrador incluye imagenes en markdown (![...](...)), consérvalas y "
    "ubicalas en el lugar mas adecuado.\n"
    "- Si el usuario aporta especificaciones, respetalas siempre que no impliquen "
    "inventar datos.\n"
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

        message = resp.choices[0].message
        content = (message.content or "").strip()
        if not content:
            reasoning = (getattr(message, "reasoning_content", None) or "").strip()
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
