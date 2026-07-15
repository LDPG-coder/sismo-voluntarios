"""Capa de servicio para multimedia.

Centraliza la validación, decodificación de ``data:`` URLs, escritura en el
backend de almacenamiento y el registro de la referencia en ``media_assets``.
Las entidades de negocio (usuario, actividad, incubadora) llaman a esta capa
en lugar de incrustar base64 en la base de datos.
"""

from __future__ import annotations

import base64
import binascii
import mimetypes
import re
import uuid

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.constants import MVP_TENANT_ID
from app.db.models.media_asset import MediaAsset, MediaOwnerType
from app.storage.local import get_storage

_DATA_URL_RE = re.compile(
    r"^data:(?P<mime>[^;]+);base64,(?P<payload>.+)$", re.DOTALL
)


class MediaError(ValueError):
    """Errores de validación o almacenamiento de multimedia."""


def decode_data_url(data_url: str) -> tuple[str, bytes]:
    """Decodifica una ``data:<mime>;base64,<...>`` y devuelve (mime, bytes)."""
    match = _DATA_URL_RE.match(data_url.strip())
    if not match:
        raise MediaError("formato de archivo inválido (se esperaba data:<mime>;base64,...)")
    mime = match.group("mime").strip().lower()
    try:
        raw = base64.b64decode(match.group("payload"), validate=True)
    except (ValueError, binascii.Error) as exc:
        raise MediaError("el contenido base64 no es válido") from exc
    return mime, raw


def _extension_for(mime: str, filename: str | None) -> str:
    if filename:
        from pathlib import Path

        suffix = "".join(Path(filename).suffixes)
        if suffix:
            return suffix
    return mimetypes.guess_extension(mime) or ""


def save_media(
    db: Session,
    *,
    owner_type: str,
    owner_id: uuid.UUID,
    kind: str,
    content_type: str,
    data: bytes,
    created_by: uuid.UUID | None = None,
    filename: str | None = None,
) -> MediaAsset:
    """Valida, persiste y registra un asset multimedia.

    Devuelve el ``MediaAsset`` cuyo ``id`` se usa para construir la URL
    pública ``{media_public_base_url}/{id}`` que consumen los clientes.
    """
    settings = get_settings()

    allowed = (
        settings.media_allowed_image_types
        if kind == "image"
        else settings.media_allowed_document_types
    )
    if content_type not in allowed:
        raise MediaError(
            f"tipo de archivo no permitido: {content_type}. Permitidos: {', '.join(allowed)}"
        )

    limit = (
        settings.media_max_image_bytes
        if kind == "image"
        else settings.media_max_document_bytes
    )
    if len(data) > limit:
        raise MediaError("el archivo es demasiado grande")

    ext = _extension_for(content_type, filename)
    reference = f"{owner_type}/{owner_id}/{uuid.uuid4().hex}{ext}"

    get_storage().save(reference=reference, content_type=content_type, data=data)

    asset = MediaAsset(
        owner_type=owner_type,
        owner_id=owner_id,
        kind=kind,
        filename=filename,
        content_type=content_type,
        byte_size=len(data),
        backend=settings.media_storage_backend,
        reference=reference,
        created_by=created_by,
    )
    asset.tenant_id = MVP_TENANT_ID
    db.add(asset)
    db.flush()
    return asset


def delete_media(db: Session, asset: MediaAsset) -> None:
    """Borra el archivo del backend y elimina la fila de referencia."""
    try:
        get_storage().delete(asset.reference)
    except OSError:
        pass
    db.delete(asset)


def media_url(asset: MediaAsset | None) -> str | None:
    """Construye la URL pública absoluta a partir del asset (o None)."""
    if asset is None or asset.deleted_at is not None:
        return None
    return f"{get_settings().media_public_base_url}/{asset.id}"


__all__ = [
    "MediaAsset",
    "MediaOwnerType",
    "MediaError",
    "decode_data_url",
    "save_media",
    "delete_media",
    "media_url",
]
