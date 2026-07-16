"""Precarga el cache de disco del proxy de fotos.

Llama al propio endpoint /api/v1/media/proxy-image para cada foto del blob.
Como el proxy ya limita la concurrencia al blob (semaphore) y cachea en
disco, esto llena /app/proxy_cache con TODAS las fotos sin reventar el
rate-limit del blob (el semaphore capa la concurrencia globalmente, incluyendo
el trafico en vivo). Una vez lleno, el navegador siempre recibe HIT-DISK y
nunca depende del blob.

Correr DENTRO del container (desacoplado):
  docker exec -d -e PYTHONPATH=/app infra-api-1 python3 /app/scripts/warm_cache.py
"""
from __future__ import annotations

import os
import time
import urllib.parse
import urllib.request

API = "http://localhost:8000"
HOST = "blobstoragex9083.blob.core.windows.net"
PREFIX = "/profilepictures"
CACHE_DIR = "/app/proxy_cache"


def main() -> None:
    from sqlalchemy import select

    from app.db.base import SessionLocal
    from app.db.models.identity import User

    db = SessionLocal()
    pattern = f"https://%{HOST}{PREFIX}%"
    urls = db.execute(select(User.photo_url).where(User.photo_url.like(pattern))).scalars().all()
    db.close()

    total = len(urls)
    done = 0
    cached = 0
    for u in urls:
        h = __import__("hashlib").sha256(u.encode()).hexdigest()
        bp = os.path.join(CACHE_DIR, h + ".bin")
        if os.path.exists(bp):
            cached += 1
            continue
        enc = urllib.parse.quote(u, safe="")
        req = urllib.request.Request(f"{API}/api/v1/media/proxy-image?url={enc}")
        try:
            with urllib.request.urlopen(req, timeout=40) as resp:
                resp.read()
            done += 1
        except Exception as e:  # noqa: BLE001
            print(f"FAIL {u}: {e}")
            time.sleep(8)
            continue
        time.sleep(2)
    print(f"DONE total={total} recien_cacheadas={done} ya_en_cache={cached}")


if __name__ == "__main__":
    main()
