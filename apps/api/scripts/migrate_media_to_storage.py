"""Migración de multimedia existente (base64 inline) al almacenamiento externo.

Recorre las entidades que hoy guardan ``data:`` URLs en la base de datos y,
para las filas que aún no tienen un ``media_asset`` asociado, decodifica el
binario, lo persiste en el backend de almacenamiento y reemplaza el valor por
la referencia pública. Es idempotente: puede ejecutarse varias veces.

Uso:
    cd apps/api
    python scripts/migrate_media_to_storage.py          # migra de verdad
    python scripts/migrate_media_to_storage.py --dry-run  # solo cuenta
"""

from __future__ import annotations

import sys
from pathlib import Path

# Hace importable el paquete `app` al ejecutar el script desde apps/api.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, update  # noqa: E402

from app.db.base import SessionLocal  # noqa: E402
from app.db.models import (  # noqa: E402
    Activity,
    ActivityEvidence,
    IncubatorAttachment,
    MediaAsset,
    MediaOwnerType,
    User,
)
from app.storage.service import decode_data_url, media_url, save_media  # noqa: E402


def _migrate_users(db, dry_run: bool) -> int:
    rows = db.execute(
        select(User).where(
            User.photo_url.isnot(None),
            User.photo_url.like("data:%"),
            User.photo_asset_id.is_(None),
        )
    ).scalars().all()
    count = 0
    for u in rows:
        mime, raw = decode_data_url(u.photo_url)
        if not dry_run:
            asset = save_media(
                db, owner_type=MediaOwnerType.USER_PHOTO, owner_id=u.id,
                kind="image", content_type=mime, data=raw, created_by=u.id,
                filename="photo",
            )
            db.flush()
            u.photo_asset_id = asset.id
            u.photo_url = media_url(asset)
        count += 1
    return count


def _migrate_evidence(db, dry_run: bool) -> int:
    rows = db.execute(
        select(ActivityEvidence).where(
            ActivityEvidence.image_url.isnot(None),
            ActivityEvidence.image_url.like("data:%"),
            ActivityEvidence.media_asset_id.is_(None),
        )
    ).scalars().all()
    count = 0
    for ev in rows:
        mime, raw = decode_data_url(ev.image_url)
        if not dry_run:
            asset = save_media(
                db, owner_type=MediaOwnerType.ACTIVITY_EVIDENCE, owner_id=ev.activity_id,
                kind="image", content_type=mime, data=raw, created_by=ev.uploaded_by,
            )
            db.flush()
            ev.media_asset_id = asset.id
            ev.image_url = media_url(asset)
        count += 1
    return count


def _migrate_incubator(db, dry_run: bool) -> int:
    rows = db.execute(
        select(IncubatorAttachment).where(
            IncubatorAttachment.data.isnot(None),
            IncubatorAttachment.data.like("data:%"),
            IncubatorAttachment.media_asset_id.is_(None),
        )
    ).scalars().all()
    count = 0
    for att in rows:
        mime, raw = decode_data_url(att.data)
        owner_id = att.project_id or att.update_id
        if not dry_run:
            asset = save_media(
                db, owner_type=MediaOwnerType.INCUBATOR_ATTACHMENT, owner_id=owner_id,
                kind=att.kind, content_type=mime, data=raw, filename=att.filename,
            )
            db.flush()
            att.media_asset_id = asset.id
            att.data = None
        count += 1
    return count


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    db = SessionLocal()
    try:
        summary = {
            "users": _migrate_users(db, dry_run),
            "evidence": _migrate_evidence(db, dry_run),
            "incubator": _migrate_incubator(db, dry_run),
        }
        if dry_run:
            print(f"[dry-run] filas a migrar: {summary}")
        else:
            db.commit()
            print(f"[ok] multimedia migrada: {summary}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
