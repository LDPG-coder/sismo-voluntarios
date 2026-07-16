"""Servido de multimedia autenticado.

Las imágenes y documentos NO se sirven como estáticos públicos: cada
petición pasa por la API y requiere sesión, preservando el control de acceso
del resto del sistema y funcionando detrás del túnel de Cloudflare actual.
Soporta rangos HTTP para la reproducción/descarga eficiente de PDFs grandes.
"""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
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


# ============================================================================
# Proxy de imágenes externas (p.ej. fotos de becarios en el blob de
# programaexcelencia). El blob devuelve Content-Type "picture" (no estándar),
# lo que algunos navegadores rechazan al renderizar un <img>. Retransmitimos la
# imagen desde el server con un Content-Type de imagen válido. Solo se permite
# el host del blob para evitar abrir un proxy SSRF.
#
# El blob de Azure aplica rate-limit (HTTP 429) cuando se piden muchas fotos a
# la vez. Para no dependender del blob en cada request cacheamos la imagen de
# forma PERSISTENTE en disco (dir configurable via PROXY_CACHE_DIR, montado
# como volumen para sobrevivir reinicios del container) y en memoria. El
# navegador también cachea con Cache-Control de larga duración. La fetch al
# blob se hace con concurrencia limitada y reintentos con backoff ante 429;
# una vez cacheada, el blob nunca se vuelve a tocar.
#
# Se registra en un router aparte (incluido ANTES que el router /media) para
# que /api/v1/media/proxy-image coincida con esta ruta y no con
# /api/v1/media/{asset_id} (que requiere sesión).
# ============================================================================
import hashlib
import os
import threading
import time
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request as _UrlRequest, urlopen

_PROXY_ALLOWED_HOST = "blobstoragex9083.blob.core.windows.net"
_PROXY_ALLOWED_PATH_PREFIX = "/profilepictures"

# Caché persistente en disco (clave = sha256 de la url). Montar como volumen
# para que sobreviva a reinicios del container.
_PROXY_CACHE_DIR = os.environ.get("PROXY_CACHE_DIR", "/app/proxy_cache")
os.makedirs(_PROXY_CACHE_DIR, exist_ok=True)
# Capa rápida en memoria (se pierde al reiniciar, pero evita leer disco).
_proxy_mem: dict[str, tuple[str, bytes]] = {}
_proxy_mem_lock = threading.Lock()
# Una sola fetch por url concurrente; el resto espera y reusa el resultado.
_proxy_url_locks: dict[str, threading.Lock] = {}
_proxy_url_locks_guard = threading.Lock()
# Límite de fetches simultáneos al blob para no disparar 429.
_proxy_sem = threading.Semaphore(3)
# Cache-Control enviado al navegador: un año, inmutable (la SAS es válida
# hasta 2034, así que la imagen no cambia).
_PROXY_BROWSER_CACHE = "public, max-age=31536000, immutable"


def _cache_paths(url: str) -> tuple[str, str]:
    h = hashlib.sha256(url.encode("utf-8")).hexdigest()
    base = os.path.join(_PROXY_CACHE_DIR, h)
    return base + ".bin", base + ".meta"


def _load_cache(url: str) -> tuple[str, bytes] | None:
    binp, metap = _cache_paths(url)
    if os.path.exists(binp) and os.path.exists(metap):
        try:
            with open(metap, "r", encoding="utf-8") as f:
                ctype = f.read().strip()
            with open(binp, "rb") as f:
                data = f.read()
            return ctype, data
        except OSError:
            return None
    return None


def _save_cache(url: str, ctype: str, data: bytes) -> None:
    binp, metap = _cache_paths(url)
    tmp_bin = binp + ".tmp"
    tmp_meta = metap + ".tmp"
    with open(tmp_bin, "wb") as f:
        f.write(data)
    with open(tmp_meta, "w", encoding="utf-8") as f:
        f.write(ctype)
    os.replace(tmp_bin, binp)
    os.replace(tmp_meta, metap)
    with _proxy_mem_lock:
        _proxy_mem[url] = (ctype, data)


def _detect_content_type(data: bytes, fallback: str) -> str:
    if data[:4] == b"\x89PNG":
        return "image/png"
    if data[:2] == b"\xff\xd8":
        return "image/jpeg"
    if data[:4] in (b"GIF8",):
        return "image/gif"
    if b"webp" in fallback.encode("utf-8", "ignore"):
        return "image/webp"
    return "image/jpeg"


def _fetch_blob(url: str) -> tuple[str, bytes]:
    """Descarga del blob con reintentos y backoff ante 429 (rate-limit)."""
    last_err: Exception | None = None
    for attempt in range(5):
        req = _UrlRequest(url, headers={"User-Agent": "sismo-image-proxy"})
        try:
            with urlopen(req, timeout=20) as resp:
                return resp.headers.get("Content-Type", ""), resp.read()
        except HTTPError as e:
            if e.code == 429:
                time.sleep(0.6 * (2 ** attempt))
                last_err = e
                continue
            raise
    raise last_err or HTTPException(status_code=502, detail="No se pudo obtener la imagen")


def _serve(ctype: str, data: bytes, cache_label: str) -> Response:
    return Response(
        content=data,
        media_type=ctype,
        headers={"Cache-Control": _PROXY_BROWSER_CACHE, "X-Cache": cache_label},
    )


proxy_router = APIRouter(tags=["media"])


@proxy_router.get("/media/proxy-image")
def proxy_image(url: str):
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or parsed.netloc != _PROXY_ALLOWED_HOST
        or not parsed.path.startswith(_PROXY_ALLOWED_PATH_PREFIX)
    ):
        raise HTTPException(status_code=400, detail="URL no permitida")

    with _proxy_mem_lock:
        cached = _proxy_mem.get(url)
    if cached is not None:
        return _serve(cached[0], cached[1], "HIT")

    cached = _load_cache(url)
    if cached is not None:
        with _proxy_mem_lock:
            _proxy_mem[url] = cached
        return _serve(cached[0], cached[1], "HIT-DISK")

    with _proxy_url_locks_guard:
        url_lock = _proxy_url_locks.setdefault(url, threading.Lock())
    with url_lock:
        # Doble chequeo: otro hilo pudo llenar la caché mientras esperábamos.
        with _proxy_mem_lock:
            cached = _proxy_mem.get(url)
        if cached is not None:
            return _serve(cached[0], cached[1], "HIT")
        cached = _load_cache(url)
        if cached is not None:
            with _proxy_mem_lock:
                _proxy_mem[url] = cached
            return _serve(cached[0], cached[1], "HIT-DISK")
        with _proxy_sem:
            try:
                ctype, data = _fetch_blob(url)
            except HTTPError:
                raise HTTPException(status_code=502, detail="No se pudo obtener la imagen")
        out_type = _detect_content_type(data, ctype)
        _save_cache(url, out_type, data)
        return _serve(out_type, data, "MISS")
