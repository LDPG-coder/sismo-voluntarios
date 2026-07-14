"""AI text formatting service: turns a raw proposal draft into clean markdown."""

from __future__ import annotations

from openai import OpenAI

from app.core.config import get_settings
from app.core.logging import get_logger

_log = get_logger("app.ai")

SYSTEM_PROMPT = (
    "Eres un redactor profesional de propuestas de proyectos sociales para una "
    "ONG oficial en Venezuela. Recibes un borrador escrito por una persona "
    "(posiblemente desordenado, informal o incompleto) y opcionalmente unas "
    "especificaciones sobre como quiere el resultado. Tu tarea es transformarlo "
    "en una propuesta clara, profesional y bien estructurada, con formato "
    "Markdown, con el tono serio y formal propio de un documento institucional "
    "de una organizacion sin fines de lucro. "
    "Responde SIEMPRE en espanol.\n\n"
    "ESTRUCTURA SUGERIDA (usa solo las secciones para las que el borrador "
    "aporte informacion; no fuerces secciones vacias, y adapta los titulos a la "
    "naturaleza del texto):\n"
    "- ## Resumen del proyecto (parrafo breve que sintetiza la propuesta)\n"
    "- ## Contexto y justificacion\n"
    "- ## Objetivo general y objetivos especificos\n"
    "- ## Beneficiarios / poblacion objetivo\n"
    "- ## Actividades y metodologia\n"
    "- ## Resultados e impacto esperado\n"
    "- ## Recursos necesarios\n"
    "Cuando el texto sea un plan de ejecucion, prioriza secciones como "
    "## Fases del proyecto, ## Cronograma, ## Responsables y ## Seguimiento.\n\n"
    "ESTILO PROFESIONAL:\n"
    "- Redacta en tercera persona o de forma institucional, con lenguaje claro, "
    "formal y respetuoso; evita coloquialismos y muletillas.\n"
    "- Mejora la redaccion y corrige ortografia y gramatica.\n"
    "- Convierte enumeraciones informales en listas con vinetas o numeradas.\n"
    "- Usa **negritas** para conceptos clave y ==resaltados== con moderacion "
    "para lo mas importante.\n\n"
    "REGLAS ESTRICTAS:\n"
    "- NO inventes datos, cifras, fechas, nombres ni compromisos que el "
    "borrador no contenga. Puedes reformular y dar estructura, pero el contenido "
    "debe salir del borrador.\n"
    "- Conserva TODA la informacion del borrador; solo reorganiza y mejora la "
    "expresion sin cambiar el significado.\n"
    "- Si el borrador es muy escueto, estructura lo que haya sin rellenar con "
    "informacion imaginaria.\n"
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
