"""Seed script for local development.

Creates a fixed dev admin user (matching the web dev-login bypass route) and
optionally inserts a handful of sample activities so every view (Lista, Semana,
Mes, Gantt) has content to render.

Idempotent: safe to run repeatedly; it skips already-existing rows.

Run inside the API container:
    docker compose -f docker-compose.dev.yml exec api python scripts/seed.py
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.db.base import SessionLocal
from app.db.constants import MVP_TENANT_ID
from app.db.models.identity import User
from app.db.models.activities import Activity
from app.db.enums import ActivityStatus, UserRole, UserStatus

DEV_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
DEV_EMAIL = "dev@sismo.local"
DEV_REFERRAL_CODE = "DEVADMIN"


def ensure_dev_admin(db) -> User:
    existing = db.execute(
        select(User).where(User.id == DEV_USER_ID)
    ).scalar_one_or_none()
    if existing:
        print(f"[seed] dev admin already exists (id={DEV_USER_ID}); skipping.")
        return existing

    user = User(
        id=DEV_USER_ID,
        email=DEV_EMAIL,
        name="Dev Admin",
        role=UserRole.admin,
        status=UserStatus.active,
        referral_code=DEV_REFERRAL_CODE,
        tenant_id=MVP_TENANT_ID,
        last_login_at=datetime.now(UTC),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"[seed] created dev admin {DEV_EMAIL} (id={DEV_USER_ID}).")
    return user


_SAMPLE_TITLES = [
    ("Limpieza de playa - Sector Norte", "limpieza", "Av. Costanera 1200, Valparaíso", "Reconstruir senderos dañados por el sismo y retirar escombros."),
    ("Reparto de agua potable", "ayuda", "Plaza Principal, Santiago", "Punto de distribución de agua y kits de primera necesidad."),
    ("Apoyo psicológico comunitario", "salud", "Calle Los Olmos 45, Viña del Mar", "Atención grupal para vecinos afectados."),
    ("Inventario de daños estructurales", "evaluacion", "Pasaje El Bosque 9, Quilpué", "Relevamiento de viviendas con daño estructural."),
    ("Taller de preparación sísmica", "educacion", "Calle Maipú 300, Rancagua", "Charla y simulacro para familias."),
]


def ensure_sample_activities(db, creator: User) -> None:
    existing = db.execute(
        select(Activity).where(Activity.creator_id == DEV_USER_ID)
    ).scalars().first()
    if existing:
        print("[seed] sample activities already exist; skipping.")
        return

    now = datetime.now(UTC)
    for i, (title, zone, address, desc) in enumerate(_SAMPLE_TITLES):
        start = now + timedelta(days=i * 2, hours=10)
        end = start + timedelta(hours=2)
        db.add(
            Activity(
                title=title,
                description=desc,
                zone=zone,
                raw_address=address,
                date_time=start,
                end_time=end,
                estimated_duration_min=120,
                max_participants=20,
                requirements="Ropa cómoda y botella de agua.",
                contact_info="dev@sismo.local",
                creator_id=creator.id,
                tenant_id=MVP_TENANT_ID,
                status=ActivityStatus.active,
            )
        )
    db.commit()
    print(f"[seed] created {len(_SAMPLE_TITLES)} sample activities.")


def main() -> None:
    settings = get_settings()
    print(f"[seed] using database {settings.db_name} @ {settings.db_host}:{settings.db_port}")
    db = SessionLocal()
    try:
        admin = ensure_dev_admin(db)
        ensure_sample_activities(db, admin)
        print("[seed] done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
