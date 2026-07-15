"""Servido de multimedia autenticado.

Las imágenes y documentos NO se sirven como estáticos públicos: cada
petición pasa por la API y requiere sesión, preservando el control de acceso
del resto del sistema y funcionando detrás del túnel de Cloudflare actual.
Soporta rangos HTTP para la reproducción/descarga eficiente de PDFs grandes.
"""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.errors import ApiError, ErrorCode
from app.core.logging import get_logger
from app.db.base import get_db
from app.db.models import MediaAsset
from app.pipeline.dependencies import require_session
from app.storage.local import get_storage

router = APIRouter(prefix="/media", tags=["media"])
_log = get_logger("app.api.v1.media")


def _parse_range(range_header: str | None, size: int) -> tuple[int, int] | None:
    if not range_header or not range_header.startswith("bytes="):
        return None
    part = range_header[len("bytes=") :].split(",")[0].strip()
    if "-" not in part:
        return None
    start_s, end_s = part.split("-", 1)
    start = int(start_s) if start_s else 0
    end = int(end_s) if end_s else size - 1
    if start < 0 or end >= size or start > end:
        return None
    return start, end


@router.get("/{asset_id}")
def serve_media(
    asset_id: str,
    request: Request,
    user: Annotated[object, Depends(require_session)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    asset = db.get(MediaAsset, UUID(asset_id))
    if asset is None or asset.deleted_at is not None:
        raise ApiError(ErrorCode.not_found, "recurso no encontrado")

    storage = get_storage()
    if not storage.exists(asset.reference):
        raise ApiError(ErrorCode.not_found, "archivo no disponible")

    handle = storage.open(asset.reference)
    size = os.fstat(handle.fileno()).st_size

    rng = _parse_range(request.headers.get("range"), size)
    if rng is not None:
        start, end = rng
        handle.seek(start)
        headers = {
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(end - start + 1),
        }

        def _chunk(start: int, end: int, fh):
            fh.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                block = fh.read(min(256 * 1024, remaining))
                if not block:
                    break
                remaining -= len(block)
                yield block
            fh.close()

        return StreamingResponse(
            _chunk(start, end, handle),
            status_code=206,
            media_type=asset.content_type or "application/octet-stream",
            headers=headers,
        )

    def _stream(fh):
        try:
            while True:
                block = fh.read(256 * 1024)
                if not block:
                    break
                yield block
        finally:
            fh.close()

    return StreamingResponse(
        _stream(handle),
        media_type=asset.content_type or "application/octet-stream",
        headers={
            "Content-Length": str(size),
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=300",
        },
    )
