"""AI text formatting service: turns a raw proposal draft into clean markdown."""

from __future__ import annotations

from openai import OpenAI

from app.core.config import get_settings
from app.core.logging import get_logger

_log = get_logger("app.ai")

_BASE_INTRO = (
    "Eres un redactor de propuestas para una plataforma de voluntariado de una "
    "ONG en Venezuela. Recibes un borrador escrito por una persona (posiblemente "
    "desordenado, informal o incompleto) y opcionalmente unas especificaciones "
    "sobre como quiere el resultado. Tu tarea es transformarlo en un texto claro, "
    "atractivo y bien estructurado en Markdown, agradable de leer. "
    "Responde SIEMPRE en espanol.\n\n"
)

# Cada seccion del formulario tiene un foco distinto: la IA debe redactar solo
# el contenido propio de esa seccion, sin invadir las demas.
_FOCUS_DESCRIPTION = (
    "ENFOQUE DE ESTA SECCION — DESCRIPCION DEL PROYECTO:\n"
    "Redacta UNICAMENTE la descripcion del proyecto: que es, por que existe, a "
    "quien beneficia y que impacto busca. Cuando aplique, usa secciones como "
    "## Resumen, ## Contexto y justificacion, ## Objetivos, ## Beneficiarios y "
    "## Impacto esperado.\n"
    "NO redactes aqui el plan de ejecucion, ni fases, ni cronograma, ni "
    "responsables, ni tareas operativas: eso pertenece a otra seccion. Si el "
    "borrador incluye detalles de ejecucion, resumelos brevemente solo si son "
    "imprescindibles para entender la descripcion, sin desarrollarlos.\n\n"
)
_FOCUS_PLAN = (
    "ENFOQUE DE ESTA SECCION — PLAN DE EJECUCION:\n"
    "Redacta UNICAMENTE como se llevara a cabo el proyecto: pasos, fases, "
    "actividades, responsables, recursos operativos y seguimiento. Cuando "
    "aplique, usa secciones como ## Fases del proyecto, ## Actividades, "
    "## Responsables, ## Recursos y ## Seguimiento (evita numerar fases o pasos "
    "como si tuvieran un orden fijo si pueden hacerse en distinto orden).\n"
    "NO reescribas aqui la descripcion general, la justificacion ni el impacto: "
    "eso pertenece a otra seccion. Centrate en lo operativo y practico.\n\n"
)
_FOCUS_GENERIC = ""

_COMMON_RULES = (
    "ADAPTA EL FORMATO A LA ESCALA:\n"
    "- Si el borrador describe algo pequeno, puntual o informal, MANTENLO breve "
    "y cercano: uno o dos parrafos, quiza una lista corta. NO impongas una "
    "estructura pesada ni secciones vacias.\n"
    "- Si el borrador es amplio o formal, dale una estructura mas completa y un "
    "tono mas institucional.\n"
    "- Usa SOLO las secciones para las que el borrador aporte informacion. La "
    "regla de oro: el formato debe ayudar a la lectura, nunca inflar un texto "
    "pequeno.\n\n"
    "MAXIMIZA EL MARKDOWN (haz la lectura lo mas agradable posible):\n"
    "- Aprovecha titulos (## y ###) para separar ideas cuando haya varias.\n"
    "- Usa **negritas** para conceptos y datos clave, *cursivas* para matices, y "
    "==resaltados== con moderacion para lo verdaderamente importante.\n"
    "- Convierte enumeraciones en listas con vinetas; usa listas de tareas "
    "(- [ ] item) para pasos o pendientes cuando encaje.\n"
    "- Usa > citas, tablas para datos comparables y --- para separar bloques "
    "cuando ayude.\n"
    "- Emplea parrafos cortos y aireados; el resultado debe verse pulido.\n\n"
    "REGLAS ESTRICTAS:\n"
    "- NO inventes datos, cifras, fechas, nombres ni compromisos que el "
    "borrador no contenga. Puedes reformular y dar formato, pero el contenido "
    "debe salir del borrador.\n"
    "- Conserva TODA la informacion del borrador que corresponda a esta seccion; "
    "solo reorganiza y mejora la expresion sin cambiar el significado.\n"
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

_FOCUS_BY_KIND = {
    "description": _FOCUS_DESCRIPTION,
    "plan": _FOCUS_PLAN,
}


def _build_system_prompt(kind: str | None) -> str:
    focus = _FOCUS_BY_KIND.get((kind or "").lower(), _FOCUS_GENERIC)
    return _BASE_INTRO + focus + _COMMON_RULES


def format_text(description: str, specs: str | None = None, kind: str | None = None) -> str | None:
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
                {"role": "system", "content": _build_system_prompt(kind)},
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
