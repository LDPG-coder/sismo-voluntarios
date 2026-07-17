"""Limpieza automatica de las publicaciones de ejemplo de la induccion.

Las actividades con ``is_demo = True`` se siembran con un ``demo_until``
(ver ``SISMO_DEMO_ACTIVITIES_TTL_DAYS``). Este modulo las borra de la BD una
vez vencido ese plazo, de forma programada (hilo en segundo plano arrancado
por el lifespan de la API) y tambien es reutilizable por el script manual
``scripts/cleanup_demo_activities.py``.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.logging import get_logger
from app.db.base import SessionLocal
from app.db.models.activities import Activity

_log = get_logger("app.services.demo_cleanup")

# Frecuencia del barrido programado (horas).
DEMO_CLEANUP_INTERVAL_HOURS = 6


def cleanup_expired_demo_activities() -> int:
    """Elimina las publicaciones de ejemplo cuya ``demo_until`` ya paso.

    Devuelve la cantidad eliminada. Nunca lanza: los errores se registran y
    se devuelve 0 para no romper el ciclo programado ni el arranque."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        ids = db.execute(
            select(Activity.id).where(
                Activity.is_demo.is_(True),
                Activity.demo_until.isnot(None),
                Activity.demo_until < now,
            )
        ).scalars().all()
        if not ids:
            return 0
        for aid in ids:
            a = db.get(Activity, aid)
            if a:
                db.delete(a)
        db.commit()
        _log.info("demo_cleanup.removed", count=len(ids))
        return len(ids)
    except Exception:
        _log.exception("demo_cleanup.failed")
        return 0
    finally:
        db.close()


def start_demo_cleanup_scheduler(interval_hours: float = DEMO_CLEANUP_INTERVAL_HOURS):
    """Arranca un hilo demonio que ejecuta la limpieza cada ``interval_hours``.

    Corre una vez al iniciar y luego cada intervalo. Devuelve una funcion para
    detenerlo (usada en el shutdown del lifespan)."""
    _stop = threading.Event()

    def _loop() -> None:
        try:
            cleanup_expired_demo_activities()
        except Exception:
            pass
        while not _stop.wait(interval_hours * 3600):
            try:
                cleanup_expired_demo_activities()
            except Exception:
                pass

    thread = threading.Thread(target=_loop, name="demo-cleanup", daemon=True)
    thread.start()
    return lambda: _stop.set()
