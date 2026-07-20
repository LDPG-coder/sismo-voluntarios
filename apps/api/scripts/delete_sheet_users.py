"""Elimina de la base de datos los usuarios listados en el CSV del sheet.

Borra en cascada todo lo relacionado con esos usuarios (membresias, evidencias,
notificaciones, actividades que crearon, proyectos de incubadora, referidos y
assets multimedia). Conserva las cuentas que NO estan en el sheet (admin, dev,
creador de actividades demo, etc.).

Idempotente: solo toca usuarios cuyo correo (case-insensitive) coincide con el
CSV. Si el usuario no existe, no pasa nada.

Uso dentro del container de la API:
    python scripts/delete_sheet_users.py [ruta_csv] [--dry-run] [--db-name NOMBRE]

Por defecto lee /tmp/sheet.csv y apunta a la BD configurada (SISMO_DB_NAME).
"""
from __future__ import annotations

import argparse
import csv
import os
import sys

# El nombre de BD se puede sobreescribir antes de importar SessionLocal.
for _i, _a in enumerate(sys.argv):
    if _a == "--db-name" and _i + 1 < len(sys.argv):
        os.environ["SISMO_DB_NAME"] = sys.argv[_i + 1]

import sqlalchemy
from sqlalchemy import text

from app.core.config import get_settings
from app.db.base import SessionLocal

DEFAULT_CSV = "/tmp/sheet.csv"


def _load_emails(path: str) -> list[str]:
    emails: list[str] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            email = (
                r.get("Correo electronico") or r.get("Correo electrónico") or ""
            ).strip().lower()
            if email:
                emails.append(email)
    return emails


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", nargs="?", default=DEFAULT_CSV)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--db-name", default=None)
    args = ap.parse_args()

    if args.db_name:
        os.environ["SISMO_DB_NAME"] = args.db_name

    settings = get_settings()
    print(f"[delete] db={settings.db_name} @ {settings.db_host}:{settings.db_port}")

    emails = _load_emails(args.csv)
    # Dedup preservando orden.
    seen: set[str] = set()
    uniq: list[str] = []
    for e in emails:
        if e not in seen:
            seen.add(e)
            uniq.append(e)
    print(f"[delete] {len(uniq)} correos unicos leidos del CSV")

    db = SessionLocal()
    try:
        rows = db.execute(
            text("SELECT id, email FROM users WHERE lower(email) = ANY(:emails)"),
            {"emails": uniq},
        ).all()
        user_ids = [r[0] for r in rows]
        matched = {r[1].lower() for r in rows}
        print(
            f"[delete] usuarios encontrados en BD: {len(user_ids)} "
            f"(no coinciden: {len(uniq) - len(matched)})"
        )
        if not user_ids:
            print("[delete] nada que borrar.")
            return

        # Conjuntos de tablas hijas para borrar primero.
        activity_ids = [
            r[0]
            for r in db.execute(
                text("SELECT id FROM activities WHERE creator_id = ANY(:ids)"),
                {"ids": user_ids},
            ).all()
        ]
        project_ids = [
            r[0]
            for r in db.execute(
                text(
                    "SELECT id FROM incubator_projects WHERE creator_id = ANY(:ids)"
                ),
                {"ids": user_ids},
            ).all()
        ]

        # Assets multimedia a eliminar (capturados antes de anular referencias).
        photo_asset_ids = [
            r[0]
            for r in db.execute(
                text(
                    "SELECT photo_asset_id FROM users "
                    "WHERE id = ANY(:ids) AND photo_asset_id IS NOT NULL"
                ),
                {"ids": user_ids},
            ).all()
        ]
        evidence_asset_ids = [
            r[0]
            for r in db.execute(
                text(
                    "SELECT media_asset_id FROM activity_evidence "
                    "WHERE (uploaded_by = ANY(:ids) OR activity_id = ANY(:aids)) "
                    "AND media_asset_id IS NOT NULL"
                ),
                {"ids": user_ids, "aids": activity_ids},
            ).all()
        ]
        attachment_asset_ids = [
            r[0]
            for r in db.execute(
                text(
                    "SELECT media_asset_id FROM incubator_attachments "
                    "WHERE project_id = ANY(:pids) AND media_asset_id IS NOT NULL"
                ),
                {"pids": project_ids},
            ).all()
        ]

        # Conteos para reporte.
        def _count(sql: str, params: dict) -> int:
            return db.execute(text(sql), params).rowcount if not args.dry_run else 0

        steps = [
            # 1. Liberar referencias en users.
            (
                "users.photo_asset_id -> NULL",
                "UPDATE users SET photo_asset_id = NULL WHERE id = ANY(:ids)",
                {"ids": user_ids},
            ),
            (
                "users.referred_by -> NULL",
                "UPDATE users SET referred_by = NULL WHERE referred_by = ANY(:ids)",
                {"ids": user_ids},
            ),
            # 2. Membresias de actividades.
            (
                "activity_members",
                "DELETE FROM activity_members WHERE user_id = ANY(:ids) "
                "OR ceded_by = ANY(:ids) OR activity_id = ANY(:aids)",
                {"ids": user_ids, "aids": activity_ids},
            ),
            # 3. Notificaciones.
            (
                "notifications",
                "DELETE FROM notifications WHERE user_id = ANY(:ids)",
                {"ids": user_ids},
            ),
            # 4. Evidencias (filas).
            (
                "activity_evidence",
                "DELETE FROM activity_evidence WHERE uploaded_by = ANY(:ids) "
                "OR activity_id = ANY(:aids)",
                {"ids": user_ids, "aids": activity_ids},
            ),
            # 6. Actividades creadas por el usuario.
            (
                "activities (creadas)",
                "DELETE FROM activities WHERE creator_id = ANY(:ids)",
                {"ids": user_ids},
            ),
            # 7. Incubadora: hijos por el usuario en proyectos ajenos.
            (
                "incubator_evaluations",
                "DELETE FROM incubator_evaluations WHERE evaluator_id = ANY(:ids)",
                {"ids": user_ids},
            ),
            (
                "incubator_contributions",
                "DELETE FROM incubator_contributions WHERE contributor_id = ANY(:ids)",
                {"ids": user_ids},
            ),
            (
                "incubator_updates",
                "DELETE FROM incubator_updates WHERE author_id = ANY(:ids)",
                {"ids": user_ids},
            ),
            (
                "incubator_accountability",
                "DELETE FROM incubator_accountability WHERE author_id = ANY(:ids)",
                {"ids": user_ids},
            ),
            # 8. Attachments que referencian assets del usuario (proyectos ajenos).
            (
                "incubator_attachments (assets de usuario)",
                "DELETE FROM incubator_attachments WHERE media_asset_id IN ("
                "SELECT id FROM media_assets WHERE created_by = ANY(:ids))",
                {"ids": user_ids},
            ),
            # 9. Proyectos creados por el usuario (cascada hijos).
            (
                "incubator_projects (creados)",
                "DELETE FROM incubator_projects WHERE creator_id = ANY(:ids)",
                {"ids": user_ids},
            ),
            # 10. Assets multimedia.
            (
                "media_assets",
                "DELETE FROM media_assets WHERE id = ANY(:ids) OR created_by = ANY(:uids)",
                {
                    "ids": sorted(
                        set(
                            photo_asset_ids
                            + evidence_asset_ids
                            + attachment_asset_ids
                        )
                    ),
                    "uids": user_ids,
                },
            ),
            # 11. Finalmente los usuarios.
            (
                "users",
                "DELETE FROM users WHERE id = ANY(:ids)",
                {"ids": user_ids},
            ),
        ]

        total = 0
        for label, sql, params in steps:
            # En dry-run ejecutamos de verdad para contar, pero al final
            # hacemos ROLLBACK en vez de COMMIT (no se modifica la BD).
            n = db.execute(text(sql), params).rowcount
            total += n
            print(f"  {label}: {n} filas")
        if args.dry_run:
            db.rollback()
            print(f"[delete] DRY-RUN: {total} filas serian eliminadas "
                  f"(rollback, sin cambios).")
        else:
            db.commit()
            print(f"[delete] total filas eliminadas: {total}")
            print("[delete] done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
