"""Implementación de ``MediaStorage`` sobre el sistema de archivos local.

Los archivos se guardan bajo ``SISMO_MEDIA_ROOT`` en rutas relativas del
estilo ``{owner_type}/{owner_id}/{uuid}{ext}``. La ruta se valida contra
traversal para que una ``reference`` manipulada no pueda escribir/leer fuera
del directorio raíz del volumen.
"""

from __future__ import annotations

import pathlib

from app.core.config import get_settings
from app.storage import MediaStorage


class LocalFilesystemStorage:
    def __init__(self, root: str) -> None:
        self.root = pathlib.Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, reference: str) -> pathlib.Path:
        # Normaliza y evita el path traversal: la ruta resuelta debe quedar
        # estrictamente por debajo de self.root.
        candidate = (self.root / reference).resolve()
        if candidate == self.root or self.root not in candidate.parents:
            raise ValueError("invalid media reference")
        return candidate

    def save(self, *, reference: str, content_type: str, data: bytes) -> None:
        path = self._resolve(reference)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def open(self, reference: str):  # -> BinaryIO
        return self._resolve(reference).open("rb")

    def delete(self, reference: str) -> None:
        path = self._resolve(reference)
        if path.exists():
            path.unlink()

    def exists(self, reference: str) -> bool:
        return self._resolve(reference).exists()


_storage: LocalFilesystemStorage | None = None


def get_storage() -> MediaStorage:
    """Devuelve la instancia configurada del backend de almacenamiento.

    Hoy solo se soporta el backend local; el selector permite en el futuro
    enchufar un backend de objetos (S3/MinIO) o Google Drive sin tocar las
    llamadas de la capa de servicio.
    """
    global _storage
    if _storage is None:
        settings = get_settings()
        if settings.media_storage_backend == "local":
            _storage = LocalFilesystemStorage(settings.media_root)
        else:
            raise RuntimeError(
                f"backend de media no soportado: {settings.media_storage_backend}"
            )
    return _storage
