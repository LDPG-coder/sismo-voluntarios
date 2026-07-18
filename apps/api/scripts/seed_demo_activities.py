"""Siembra las publicaciones de ejemplo para la induccion de becarios.

Estas actividades llevan ``is_demo = True`` y ``demo_until`` = ahora + TTL
(ver ``SISMO_DEMO_ACTIVITIES_TTL_DAYS``, default 3 dias). Se muestran en el
feed de descubrimiento solo mientras el becario esta en el tour
(``GET /activities?include_demo=true``) y un script de mantenimiento las borra
de la BD al vencer el TTL.

Es idempotente: si ya existen publicaciones de ejemplo, no crea duplicados
(salvo ``--force``, que las recrea).

Ejecutar dentro del container de la API:
    python -m scripts.seed_demo_activities
    python -m scripts.seed_demo_activities --force
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.base import SessionLocal
from app.db.constants import MVP_TENANT_ID
from app.db.models.activities import Activity, _compute_realized_hours
from app.db.models.identity import User

DEMO_AUTHOR_EMAIL = "demo.onboarding@sismo.local"
DEMO_AUTHOR_NAME = "SISMO (Ejemplo)"


# (titulo, descripcion, zona, direccion, duracion_min, dias_desde_hoy,
#  interna, oficial_externa, privada, max_participantes)
DEMO_ACTIVITIES = [
    dict(
        title="Ejemplo: Jornada de limpieza del río",
        description=(
            "Publicación de ejemplo para practicar. En una actividad real TÚ "
            "ofreces una actividad así para que otros voluntarios se inscriban. "
            "Fíjate en el botón “Ceder cupo” que aparece cuando te anotas."
        ),
        zone="Parque Lineal, San Cristóbal",
        address="Bajada del puente, junto al malecón",
        dur=180,
        days=2,
        internal=True,
        external=False,
        private=False,
        max=15,
    ),
    dict(
        title="Ejemplo: Apoyo en comedor comunitario",
        description=(
            "Publicación de ejemplo para practicar. Aquí puedes inscribirte "
            "(“Unirme”) para participar como voluntario: esto es “recibir” horas "
            "dentro del programa."
        ),
        zone="Sector La Ladera, San Cristóbal",
        address="Casa comunitaria, calle principal",
        dur=240,
        days=3,
        internal=False,
        external=False,
        private=False,
        max=20,
    ),
    dict(
        title="Ejemplo: Taller de educación ambiental",
        description=(
            "Publicación de ejemplo con registro previo. Observa la etiqueta "
            "“Registro previo”: son actividades cerradas donde el creador aprueba "
            "tu participación antes de confirmarte."
        ),
        zone="Sede AVAA, San Cristóbal",
        address="Av. Universidad, local AVAA",
        dur=120,
        days=5,
        internal=False,
        external=False,
        private=True,
        max=12,
    ),
    dict(
        title="Ejemplo: Jornada médica voluntaria",
        description=(
            "Publicación de ejemplo oficial (etiqueta “Oficial”). Estas las "
            "publica la coordinación SEP; usa el filtro por zona para encontrar "
            "actividades cerca de ti."
        ),
        zone="Plaza Venezuela, Chacao",
        address="Frente al teatro, entrada principal",
        dur=300,
        days=7,
        internal=False,
        external=True,
        private=False,
        max=30,
    ),
    dict(
        title="Ejemplo: Reforestación en el Ávila",
        description=(
            "Publicación de ejemplo para practicar. Cambia de vista (lista, "
            "calendario, mapa) y filtra por zona para explorar las actividades "
            "disponibles."
        ),
        zone="Teleférico, El Ávila",
        address="Estación La California",
        dur=240,
        days=10,
        internal=True,
        external=False,
        private=False,
        max=25,
    ),
]


def _get_or_create_demo_author(db: SessionLocal) -> User:
    existing = db.execute(
        select(User).where(User.email == DEMO_AUTHOR_EMAIL)
    ).scalar_one_or_none()
    if existing:
        return existing
    author = User(
        email=DEMO_AUTHOR_EMAIL,
        name=DEMO_AUTHOR_NAME,
        auth_source="sep",
        role="volunteer",
        status="active",
        referral_code=f"DEMO{uuid4().hex[:8].upper()}",
    )
    author.tenant_id = MVP_TENANT_ID
    db.add(author)
    db.flush()
    return author


def main() -> None:
    settings = get_settings()
    ttl_days = settings.demo_activities_ttl_days
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Elimina las publicaciones de ejemplo existentes y las recrea.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existing_count = db.execute(
            select(func.count()).select_from(Activity).where(Activity.is_demo.is_(True))
        ).scalar_one()
        if existing_count and not args.force:
            print(
                f"Ya existen {existing_count} publicaciones de ejemplo. "
                "No se crean duplicados (usa --force para recrearlas)."
            )
            return

        if args.force and existing_count:
            demo_ids = db.execute(
                select(Activity.id).where(Activity.is_demo.is_(True))
            ).scalars().all()
            for aid in demo_ids:
                a = db.get(Activity, aid)
                if a:
                    db.delete(a)
            db.commit()
            print(f"Eliminadas {len(demo_ids)} publicaciones de ejemplo previas.")

        author = _get_or_create_demo_author(db)
        now = datetime.now(timezone.utc)
        demo_until = now + timedelta(days=ttl_days)
        created = 0
        for d in DEMO_ACTIVITIES:
            dt = now + timedelta(days=d["days"])
            end = dt + timedelta(minutes=d["dur"])
            act = Activity(
                title=d["title"],
                description=d["description"],
                zone=d["zone"],
                raw_address=d["address"],
                date_time=dt,
                end_time=end,
                estimated_duration_min=d["dur"],
                max_participants=d.get("max", 10),
                requirements="Llevar ganas de ayudar.",
                contact_info="—",
                is_internal=d.get("internal", False),
                is_private=d.get("private", False),
                external_beneficiary=("Coordinación SEP" if d.get("external") else None),
                is_demo=True,
                demo_until=demo_until,
                creator_id=author.id,
                status="active",
            )
            act.realized_hours = _compute_realized_hours(act)
            act.tenant_id = MVP_TENANT_ID
            db.add(act)
            created += 1
            print(f"  + {d['title']} (demo_until={demo_until.date().isoformat()})")
        db.commit()
        print(
            f"\nCreadas {created} publicaciones de ejemplo (TTL={ttl_days} dias, "
            f"autor={author.name}). Se ocultan al vencer el TTL."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
