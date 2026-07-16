"""Enlaza fotos de perfil de becarios a los usuarios usando la URL externa.

Fuente: HTML de las paginas de admin de programaexcelencia.org
(https://www.programaexcelencia.org/admin/becarios{,/egresados,/proximoAEgresar}).
La tabla esta paginada en la vista, PERO el payload RSC embebido en el HTML
ya trae el array completo de becarios con "dni" (cedula, solo digitos) y
"profilePhoto" (URL del blob SAS). Por eso basta descargar el HTML con curl
(y la cookie de sesion); NO hace falta Playwright ni hacer click.

El script:
  1. Extrae (cedula, url_foto) del payload RSC del HTML.
  2. Normaliza la cedula y busca el User por users.cedula.
  3. Guarda la URL externa directamente en user.photo_url (NO se descarga ni
     se rehostea: el blob es SAS de solo lectura valido hasta 2034 y la web
     la muestra tal cual).

Idempotente: omite usuarios que ya tienen foto salvo --force.

Ejecutar DENTRO del container de la API (tiene la app y la BD):
  docker cp scripts/scrape_becarios_photos.py infra-api-1:/app/scripts/
  docker cp becarios.html egresados.html proximoAEgresar.html infra-api-1:/tmp/
  docker compose -f infra/docker-compose.yml exec -T -e PYTHONPATH=/app api \
    /usr/local/bin/docker-entrypoint.sh python3 /app/scripts/scrape_becarios_photos.py \
    --html /tmp/becarios.html --html /tmp/egresados.html --html /tmp/proximoAEgresar.html

Descargar el HTML (desde cualquier lado con la cookie, p.ej. cookies.txt Netscape):
  curl -sL --cookie cookies.txt -A "Mozilla/5.0" \
    "https://www.programaexcelencia.org/admin/becarios" -o becarios.html
  # mismo comando con /egresados y /proximoAEgresar
"""
from __future__ import annotations

import argparse
import re
from html.parser import HTMLParser

from sqlalchemy import select

from app.core.config import get_settings
from app.db.base import SessionLocal
from app.db.models.identity import User

_BLOB_HOST = "blobstoragex9083.blob.core.windows.net/profilepictures"
_BLOB_PREFIX = "https://" + _BLOB_HOST
# El HTML trae el payload como JSON (no como tabla HTML). La fuente FIEL de la
# asociacion cedula<->foto es el array "tableData": cada objeto de fila tiene
# "id", "name", "profilePhoto", "dni", ... juntos y en orden. USAR ESTE array
# (no los elementos RSC sueltos) porque en el arbol RSC React reutiliza objetos
# por id y la foto queda desasociada de su cedula.
_TABLE_DATA_RE = re.compile(r'\\"tableData\\":\[')
_DNI_RE = re.compile(r'\\"dni\\":\\"(\d+)\\"')
# La URL viene con escapes JSON: & se codifica como \u0026. Permitimos
# \uXXXX dentro de la URL para no cortar el match en la barra invertida.
_PHOTO_RE = re.compile(
    r'\\"profilePhoto\\":\\"(https://'
    + re.escape(_BLOB_HOST)
    + r'(?:[^\\"]|\\u[0-9a-fA-F]{4})*)\\"'
)


def _unescape_url(raw: str) -> str:
    return raw.replace("\\u0026", "&").replace("\\u002F", "/")


def _extract_table_data_arrays(txt: str) -> list[str]:
    """Devuelve el contenido (sin corchetes) de cada array \"tableData\":[...].

    Respeta strings y escapes para no cortar en un ']' que este adentro de un
    valor.
    """
    arrays: list[str] = []
    for m in _TABLE_DATA_RE.finditer(txt):
        i = m.end()  # justo despues de '['
        depth = 1
        j = i
        n = len(txt)
        instr = False
        esc = False
        while j < n:
            c = txt[j]
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                instr = not instr
            elif not instr:
                if c == "[":
                    depth += 1
                elif c == "]":
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
            j += 1
        arrays.append(txt[i : j - 1])
    return arrays


def _top_level_objects(arr: str) -> list[tuple[int, int]]:
    """Devuelve los spans (start, end) de los objetos de PRIMER NIVEL dentro del
    array (cada fila de la tabla es un objeto autocontenido). Asi garantizamos
    que dni/profilePhoto/name que extraigamos pertenecen al MISMO becario.
    """
    objs: list[tuple[int, int]] = []
    depth = 0
    start: int | None = None
    instr = False
    esc = False
    n = len(arr)
    for j in range(n):
        c = arr[j]
        if esc:
            esc = False
        elif c == "\\":
            esc = True
        elif c == '"':
            instr = not instr
        elif not instr:
            if c == "{":
                if depth == 0:
                    start = j
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0 and start is not None:
                    objs.append((start, j + 1))
                    start = None
    return objs


def _parse_html(path: str) -> list[tuple[str, str | None]]:
    txt = open(path, encoding="utf-8").read()
    rows: list[tuple[str, str | None]] = []
    for arr in _extract_table_data_arrays(txt):
        for (s, e) in _top_level_objects(arr):
            seg = arr[s:e]
            dm = _DNI_RE.search(seg)
            if not dm:
                continue
            cedula = dm.group(1)
            pm = _PHOTO_RE.search(seg)
            url = _unescape_url(pm.group(1)) if pm else None
            rows.append((cedula, url))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", action="append", required=True, help="HTML a parsear (se puede repetir)")
    ap.add_argument("--force", action="store_true", help="re-enlazar incluso si el usuario ya tiene foto")
    ap.add_argument("--dry-run", action="store_true", help="no escribir, solo reportar")
    args = ap.parse_args()

    settings = get_settings()
    print(f"[scrape] db={settings.db_name} @ {settings.db_host}:{settings.db_port}")

    all_rows: list[tuple[str, str | None]] = []
    for h in args.html:
        r = _parse_html(h)
        print(f"[scrape] {h}: {len(r)} filas (cedula, foto?)")
        all_rows.extend(r)

    # Fusiona por cedula: si aparece en varios archivos, prefiere el que tiene foto.
    source: dict[str, str | None] = {}
    for cedula, url in all_rows:
        if not cedula:
            continue
        if cedula in source:
            if source[cedula] is None and url is not None:
                source[cedula] = url
        else:
            source[cedula] = url

    db = SessionLocal()
    matched = linked = cleared = no_change = not_found = errors = 0
    try:
        # 1) Reconcilia cada cedula presente en la fuente.
        for cedula, url in source.items():
            user = db.execute(
                select(User).where(User.cedula == cedula)
            ).scalar_one_or_none()
            if user is None:
                not_found += 1
                continue
            matched += 1
            current = user.photo_url
            is_blob = bool(current and current.startswith(_BLOB_PREFIX))
            if url is not None:
                # Enlaza/_corrige solo si esta vacio o ya era una foto del blob
                # (scrapeada). Si el usuario subio su propia foto, se respeta.
                if current != url and (current is None or is_blob):
                    if not args.dry_run:
                        try:
                            user.photo_url = url
                        except Exception as e:  # noqa: BLE001
                            errors += 1
                            print(f"[scrape] ERROR en {user.email}: {e}")
                            continue
                    linked += 1
                else:
                    no_change += 1
            else:
                # La fuente no tiene foto para esta cedula: si quedo una foto
                # del blob (mal enlazada), la borramos. Si subio su propia foto,
                # se respeta.
                if is_blob:
                    if not args.dry_run:
                        user.photo_url = None
                    cleared += 1
                else:
                    no_change += 1

        # 2) Limpia fotos del blob que hayan quedado en usuarios cuya cedula NO
        #    aparece en la fuente (enlaces huerfanos/malos).
        orphan_conds = [
            User.photo_url.isnot(None),
            User.photo_url.like(_BLOB_PREFIX + "%"),
        ]
        if source:
            orphan_conds.append(User.cedula.notin_(list(source.keys())))
        orphan_blob = db.execute(
            select(User).where(*orphan_conds)
        ).scalars().all()
        for u in orphan_blob:
            if not args.dry_run:
                u.photo_url = None
            cleared += 1

        if not args.dry_run:
            db.commit()
        print(
            f"[scrape] fuente={len(source)} coincidencias={matched} "
            f"enlazadas/corregidas={linked} limpiadas={cleared} "
            f"sin_cambio={no_change} sin_usuario={not_found} errores={errors}"
        )
        print("[scrape] done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
