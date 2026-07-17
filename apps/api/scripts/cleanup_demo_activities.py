"""Elimina las publicaciones de ejemplo de la induccion ya vencidas.

Borra las actividades con ``is_demo = True`` cuyo ``demo_until`` ya paso.
Debe ejecutarse periodicamente (cron / tarea programada). El TTL lo define
``SISMO_DEMO_ACTIVITIES_TTL_DAYS`` al sembrarlas, pero aqui se respeta el
``demo_until`` guardado en cada fila.

Ejecutar dentro del container de la API:
    python -m scripts.cleanup_demo_activities
"""
from __future__ import annotations

from app.services.demo_cleanup import cleanup_expired_demo_activities


def main() -> None:
    removed = cleanup_expired_demo_activities()
    if removed == 0:
        print("No hay publicaciones de ejemplo vencidas para eliminar.")
    else:
        print(f"Eliminadas {removed} publicaciones de ejemplo vencidas.")


if __name__ == "__main__":
    main()
