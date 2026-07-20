"""Siembra actividades de ejemplo entrelazadas para pruebas de UI.

Elige 20 usuarios (obligatoriamente incluye la cedula 30597979 = LUIS DANIEL
PORTO) y crea actividades de los 2 tipos de registro:

  * no_oficial     -> tareas internas rapidas (is_internal=True).
  * pasado         -> registro de actividad ya realizada, privada del creador
                      (is_private=True, sin participantes).

...en distintas etapas (status): active, cancelled y archived.

Variaciones de las 20 personas aparecen en la MISMA actividad (como creadora y/o
participante) para ejercitar los avatares de "Publicado por" y de los
asistentes.

Es idempotente: elimina primero las actividades marcadas con "EJEMPLO ·".

Ejecutar DENTRO del container de la API:
  docker cp apps/api/scripts/seed_example_activities.py infra-api-1:/app/scripts/
  docker compose -f infra/docker-compose.yml exec -T -e PYTHONPATH=/app api \
    /usr/local/bin/docker-entrypoint.sh python3 /app/scripts/seed_example_activities.py
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.db.base import SessionLocal
from app.db.models.activities import Activity, _compute_realized_hours
from app.db.models.activity_members import ActivityMember
from app.db.models.identity import User

MARKER = "EJEMPLO ·"
NOW = datetime.now(timezone.utc)

# 20 cedulas: la primera es la requerida (30597979 = LUIS DANIEL PORTO, foto de
# Google). El resto se eligen porque TODOS ya tienen photo_url (blob o Google),
# asi los avatares renderizan en todas partes (feed, ceder cupo, perfil).
CEDULAS = [
    "30597979",  # U0  LUIS DANIEL PORTO (requerido, foto Google)
    "24750026",  # U1
    "25024389",  # U2
    "25051348",  # U3
    "25209949",  # U4
    "25716183",  # U5
    "25845648",  # U6
    "26021645",  # U7
    "26153847",  # U8
    "26198078",  # U9
    "26357995",  # U10
    "26435618",  # U11
    "26476669",  # U12
    "26619188",  # U13
    "26647396",  # U14
    "26683365",  # U15
    "26687281",  # U16
    "26738403",  # U17
    "26748575",  # U18
    "26836416",  # U19
]
U = {i: c for i, c in enumerate(CEDULAS)}

# Definicion de las actividades. members = [(cedula, attended)] para actividades
# no privadas. attended: True/False (realizado) o None (aun no culmina).
ACTIVITIES = [
    # ---------------- NO OFICIAL (tareas internas rápidas) ------------------
    dict(kind="no_oficial", status="active", creator=U[2], days=3, dur=90,
         maxp=4, zone="Oficina AVAA, San Cristóbal",
         address="Av. Universidad, local AVAA",
         desc="Acompañamiento en archivo y digitalización de expedientes.",
         req="Conocimientos básicos de office.", contact="0412-000-0011",
         members=[(U[0], None), (U[1], None), (U[17], None), (U[18], None), (U[19], None)]),
    dict(kind="no_oficial", status="archived", creator=U[3], days=-8, dur=120,
         maxp=3, zone="Sede AVAA, San Cristóbal",
         address="Sala de reuniones",
         desc="Apoyo en preparación de material para becarios.",
         req="Puntualidad.", contact="0412-000-0012",
         members=[(U[4], True), (U[5], True)]),
    dict(kind="no_oficial", status="cancelled", creator=U[6], days=-2, dur=60,
         maxp=2, zone="Sede AVAA, San Cristóbal",
         address="Recepcion",
         desc="Rotulado de carpetas (cancelada).",
         req="—", contact="0412-000-0013",
         members=[(U[7], None)]),
    dict(kind="no_oficial", status="archived", creator=U[8], days=-15, dur=150,
         maxp=6, zone="Sede AVAA, San Cristóbal",
         address="Patio central",
         desc="Jornada interna de acomodo del almacén.",
         req="Ropa cómoda.", contact="0412-000-0014",
         members=[(U[9], True), (U[10], True), (U[11], True)]),
    dict(kind="no_oficial", status="active", creator=U[12], days=-4, dur=90,
         maxp=3, zone="Sede AVAA, San Cristóbal",
         address="Sala de cómputo",
         desc="Soporte en registro de asistencia de talleres.",
         req="Manejo de planillas.", contact="0412-000-0015",
         members=[(U[13], True)]),

    # ---------------- PASADO (registro previo, privado del creador) ---------
    dict(kind="pasado", status="archived", creator=U[14], days=-30, dur=240,
         maxp=0, zone="Comunidad El Palmar, San Cristóbal",
         address="Casa de la cultura",
         desc="Registro previo: apoyo en minga de arbolado.",
         req="—", contact="0412-000-0021", members=[]),
    dict(kind="pasado", status="archived", creator=U[15], days=-12, dur=180,
         maxp=0, zone="Sector El Triunfo, Táriba",
         address="Galerón comunitario",
         desc="Registro previo: mudanza y acondicionamiento de aula.",
         req="—", contact="0412-000-0022", members=[]),
    dict(kind="pasado", status="cancelled", creator=U[16], days=-6, dur=120,
         maxp=0, zone="Barrio Obrero, San Cristóbal",
         address="Sala vecinal",
         desc="Registro previo: taller de manualidades (no realizado).",
         req="—", contact="0412-000-0023", members=[]),
]


def main() -> None:
    db = SessionLocal()
    try:
        # Usuarios y admin
        users = {
            c: db.execute(select(User).where(User.cedula == c)).scalar_one()
            for c in CEDULAS
        }

        # Limpieza idempotente
        prev = db.execute(
            select(Activity.id).where(Activity.title.like(MARKER + "%"))
        ).scalars().all()
        if prev:
            db.execute(delete(ActivityMember).where(ActivityMember.activity_id.in_(prev)))
            db.execute(delete(Activity).where(Activity.id.in_(prev)))
            db.commit()
            print(f"Eliminadas {len(prev)} actividades de ejemplo previas.")

        created = 0
        for idx, a in enumerate(ACTIVITIES, start=1):
            creator = users[a["creator"]]
            first = " ".join(creator.name.split()[:2])
            if a["kind"] == "pasado":
                title = f"{MARKER}Registro previo {idx} de {first}"
            else:
                title = f"{MARKER}Actividad de ejemplo {idx} de {first}"

            dt = NOW + timedelta(days=a["days"])
            end = dt + timedelta(minutes=a["dur"])
            is_internal = a["kind"] == "no_oficial"
            is_private = a["kind"] == "pasado"

            act = Activity(
                title=title,
                description=a["desc"],
                zone=a["zone"],
                raw_address=a["address"],
                date_time=dt,
                end_time=end,
                estimated_duration_min=a["dur"],
                max_participants=a["maxp"] or None,
                requirements=a["req"],
                contact_info=a["contact"],
                is_internal=is_internal,
                is_private=is_private,
                creator_id=creator.id,
                status=a["status"],
            )
            act.realized_hours = _compute_realized_hours(act)
            db.add(act)
            db.flush()

            for ced, attended in a["members"]:
                db.add(ActivityMember(
                    activity_id=act.id,
                    user_id=users[ced].id,
                    status="active",
                    attended=attended,
                    ceded_at=None,
                ))
            created += 1
            print(f"  [{idx:02d}] {a['kind']:<10} {a['status']:<17} creador={first:<28} "
                  f"miembros={len(a['members'])}")
        db.commit()
        print(f"\nCreadas {created} actividades de ejemplo con {len(CEDULAS)} usuarios "
              f"(incl. cedula 30597979 = {users['30597979'].name}).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
