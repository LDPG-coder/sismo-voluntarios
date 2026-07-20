"""Creacion de la publicacion de ejemplo *privada* por usuario.

A diferencia de las publicaciones de ejemplo compartidas (que se siembran una
vez con un autor ficticio y aparecen en el feed de descubrimiento durante el
tour), la publicacion privada de practica debe parecer creada por el propio
becario: se crea bajo su ``creator_id`` la primera vez que inicia la induccion,
de modo que aparece en su "Mis actividades" como una actividad privada propia.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.constants import MVP_TENANT_ID
from app.db.models import Activity, User
from app.db.models.activities import _compute_realized_hours

PRIVATE_DEMO = dict(
    title="Ejemplo: Apoyo a proyecto de reciclaje de ropa en centro de acopio",
    description=(
        "Publicación de ejemplo para practicar. Esta actividad es privada "
        "(solo tú la ves) y sirve para registrar actividades realizadas."
    ),
    zone="La Guaira",
    address="Centro de acopio, zona de clasificación de ropa",
    dur=300,
    days=7,
    max=30,
)


def ensure_user_demo_activity(db: Session, user: User) -> Activity | None:
    """Crea la publicacion privada de practica para ``user`` si aun no la tiene.

    Devuelve la actividad existente o la recien creada. Es idempotente: no
    duplica si el usuario ya posee una actividad de ejemplo privada."""
    existing = db.execute(
        select(Activity).where(
            Activity.creator_id == user.id,
            Activity.is_demo.is_(True),
            Activity.is_private.is_(True),
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    settings = get_settings()
    ttl_days = settings.demo_activities_ttl_days
    now = datetime.now(timezone.utc)
    demo_until = now + timedelta(days=ttl_days)
    dt = now + timedelta(days=PRIVATE_DEMO["days"])
    end = dt + timedelta(minutes=PRIVATE_DEMO["dur"])

    act = Activity(
        title=PRIVATE_DEMO["title"],
        description=PRIVATE_DEMO["description"],
        zone=PRIVATE_DEMO["zone"],
        raw_address=PRIVATE_DEMO["address"],
        date_time=dt,
        end_time=end,
        estimated_duration_min=PRIVATE_DEMO["dur"],
        max_participants=PRIVATE_DEMO["max"],
        requirements="Llevar ganas de ayudar.",
        contact_info="—",
        is_internal=False,
        is_private=True,
        is_demo=True,
        demo_until=demo_until,
        creator_id=user.id,
        status="active",
    )
    act.realized_hours = _compute_realized_hours(act)
    act.tenant_id = MVP_TENANT_ID
    db.add(act)
    db.commit()
    db.refresh(act)
    return act
