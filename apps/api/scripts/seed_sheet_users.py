"""Seed users from the whitelist Google Sheet CSV.

Lee un CSV con columnas: Nombre, Cedula, Genero, Celular whatsapp,
Correo electronico y crea usuarios en la tabla `users` con los nuevos
campos (cedula, gender, whatsapp). Los usuarios se crean con
auth_source="google" y status="active" para que puedan iniciar sesion con
Google (el flujo OAuth solo permite el alta de cuentas preexistentes).

Idempotente: omite correos ya existentes y evita colisiones de cedula
(unique). Normaliza nombre (espacios), genero (M/F/O -> texto) y whatsapp
a formato E.164 de Venezuela cuando aplica.

Uso dentro del container de la API:
    python scripts/seed_sheet_users.py [ruta_csv]
Por defecto lee /tmp/sheet.csv.
"""
from __future__ import annotations

import csv
import re
import sys
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.config import get_settings
from app.core.utils import generate_referral_code
from app.db.base import SessionLocal
from app.db.constants import MVP_TENANT_ID
from app.db.models.identity import User
from app.db.enums import UserRole, UserStatus

DEFAULT_CSV = "/tmp/sheet.csv"

_GENDER_MAP = {
    "m": "masculino",
    "f": "femenino",
    "o": "otro",
}


def _norm_name(raw: str) -> str:
    return re.sub(r"\s+", " ", (raw or "").strip())


def _norm_cedula(raw: str) -> str | None:
    s = (raw or "").strip()
    if not s:
        return None
    digits = re.sub(r"\D", "", s)
    return digits or None


def _norm_gender(raw: str) -> str | None:
    s = (raw or "").strip().lower()
    if not s:
        return None
    return _GENDER_MAP.get(s, s)


def _norm_whatsapp(raw: str) -> str | None:
    s = (raw or "").strip()
    if not s:
        return None
    s = re.sub(r"[^\d+]", "", s)
    if not s:
        return None
    if s.startswith("+"):
        return s
    # Quita ceros iniciales (p.ej. 0426... -> 426...).
    s = s.lstrip("0")
    if s.startswith("58"):
        return "+" + s
    # Movil venezolano de 10 digitos sin el 0 inicial (412..., 414...).
    if len(s) == 10 and s[0] == "4":
        return "+58" + s
    if len(s) == 11 and s.startswith("58"):
        return "+" + s
    # Mejor esfuerzo: asumir Venezuela.
    return "+58" + s


def _load_rows(path: str) -> list[dict]:
    rows: list[dict] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        # Cabeceras del sheet con y sin tilde.
        for r in reader:
            email = (
                r.get("Correo electronico") or r.get("Correo electrónico") or ""
            ).strip().lower()
            if not email:
                continue
            rows.append(
                {
                    "name": _norm_name(r.get("Nombre", "")),
                    "cedula": _norm_cedula(r.get("Cedula") or r.get("Cédula") or ""),
                    "gender": _norm_gender(r.get("Genero") or r.get("Género") or ""),
                    "whatsapp": _norm_whatsapp(r.get("Celular whatsapp", "")),
                    "email": email,
                }
            )
    return rows


def _unique_referral(db, used: set[str]) -> str:
    for _ in range(20):
        code = generate_referral_code()
        if code in used:
            continue
        exists = db.execute(
            select(User).where(User.referral_code == code)
        ).scalar_one_or_none()
        if not exists:
            used.add(code)
            return code
    raise RuntimeError("no se pudo generar un codigo de referido unico")


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    settings = get_settings()
    print(f"[seed] db={settings.db_name} @ {settings.db_host}:{settings.db_port}")
    print(f"[seed] leyendo {path}")

    raw_rows = _load_rows(path)
    print(f"[seed] {len(raw_rows)} filas leidas del CSV")

    # Dedup por correo (case-insensitive), conserva la primera ocurrencia.
    seen_emails: set[str] = set()
    rows: list[dict] = []
    dup_emails = 0
    for r in raw_rows:
        if r["email"] in seen_emails:
            dup_emails += 1
            continue
        seen_emails.add(r["email"])
        rows.append(r)
    if dup_emails:
        print(f"[seed] {dup_emails} filas duplicadas por correo omitidas")

    db = SessionLocal()
    used_referral: set[str] = set()
    existing_cedulas: set[str] = {
        c
        for (c,) in db.execute(select(User.cedula)).all()
        if c
    }
    skipped = created = updated = 0
    try:
        for r in rows:
            existing = db.execute(
                select(User).where(User.email == r["email"])
            ).scalar_one_or_none()
            if existing:
                # Backfill de campos faltantes en usuarios ya existentes.
                changed = False
                if not existing.cedula and r["cedula"] and r["cedula"] not in existing_cedulas:
                    existing.cedula = r["cedula"]
                    existing_cedulas.add(r["cedula"])
                    changed = True
                if not existing.gender and r["gender"]:
                    existing.gender = r["gender"]
                    changed = True
                if not existing.whatsapp and r["whatsapp"]:
                    existing.whatsapp = r["whatsapp"]
                    changed = True
                if not existing.name and r["name"]:
                    existing.name = r["name"]
                    changed = True
                if changed:
                    updated += 1
                else:
                    skipped += 1
                continue

            cedula = r["cedula"]
            if cedula and cedula in existing_cedulas:
                print(
                    f"[seed] cedula {cedula} ya existe, se omite para {r['email']}"
                )
                cedula = None
            if cedula:
                existing_cedulas.add(cedula)

            user = User(
                email=r["email"],
                name=r["name"] or None,
                cedula=cedula,
                gender=r["gender"],
                whatsapp=r["whatsapp"],
                auth_source="google",
                role=UserRole.volunteer.value,
                status=UserStatus.active.value,
                referral_code=_unique_referral(db, used_referral),
                tenant_id=MVP_TENANT_ID,
                last_login_at=None,
            )
            db.add(user)
            created += 1
        db.commit()
        print(
            f"[seed] creados={created} actualizados={updated} "
            f"omitidos(sin cambios)={skipped}"
        )
        print("[seed] done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
