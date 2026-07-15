"""Almacenamiento de multimedia desacoplado de la base de datos.

La arquitectura define un ``MediaStorage`` (protocolo) cuya única
implementación en producción es ``LocalFilesystemStorage``: los archivos se
escriben en un volumen del servidor y la base de datos guarda ÚNICAMENTE una
referencia (ruta relativa) en ``media_assets``. El protocolo deja la puerta
abierta a un backend de objetos (S3/MinIO) o a Google Drive como respaldo en
frío, sin tocar el resto del código.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class MediaStorage(Protocol):
    """Contrato de un backend de almacenamiento de archivos binarios."""

    def save(self, *, reference: str, content_type: str, data: bytes) -> None:
        """Persiste ``data`` en ``reference`` (ruta/key opaco del backend)."""
        ...

    def open(self, reference: str):  # -> BinaryIO
        """Abre el archivo en modo lectura binaria para servirlo por streaming."""
        ...

    def delete(self, reference: str) -> None:
        """Elimina el archivo referenciado si existe."""
        ...

    def exists(self, reference: str) -> bool:
        """Indica si ``reference`` existe en el backend."""
        ...
