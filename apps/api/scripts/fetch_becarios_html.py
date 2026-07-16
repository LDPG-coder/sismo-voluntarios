"""Descarga el HTML de la lista COMPLETA de becarios (requiere click).

La tabla de /admin/becarios esta paginada y la "lista completa" solo aparece
al hacer click en el boton de expandir (icono de flechas hacia afuera,
<button type="button">). Este script usa Playwright para:
  1. Abrir la pagina con la cookie de sesion de NextAuth.
  2. Hacer click en ese boton.
  3. Esperar a que la tabla grande se renderice.
  4. Guardar el HTML completo en becarios_full.html.

Requisitos (en tu maquina, no en el server):
  pip install playwright
  playwright install chromium

Uso:
  python fetch_becarios_html.py \
    --session-token "eyJhbGciOiJkaXIi..." \
    --out becarios_full.html

Luego copia becarios_full.html al server y corre scrape_becarios_photos.py.
"""
from __future__ import annotations

import argparse
import json

from playwright.sync_api import sync_playwright

BASE_URL = "https://www.programaexcelencia.org/admin/becarios"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--session-token", required=True, help="valor de __Secure-next-auth.session-token")
    ap.add_argument(
        "--url",
        default=BASE_URL,
        help="pagina a scrapear (p.ej. .../admin/becarios, .../egresados, .../proximoAEgresar)",
    )
    ap.add_argument("--out", default="becarios_full.html")
    ap.add_argument("--csrf-token", default="")
    ap.add_argument("--callback-url", default="https%3A%2F%2Fwww.programaexcelencia.org%2Fsignin")
    ap.add_argument("--wait-rows", type=int, default=250, help="esperar hasta N filas con foto")
    args = ap.parse_args()

    cookies = [
        {
            "name": "__Secure-next-auth.session-token",
            "value": args.session_token,
            "domain": "www.programaexcelencia.org",
            "path": "/",
            "secure": True,
            "httpOnly": True,
            "sameSite": "Lax",
        },
        {
            "name": "__Secure-next-auth.callback-url",
            "value": args.callback_url,
            "domain": "www.programaexcelencia.org",
            "path": "/",
            "secure": True,
            "sameSite": "Lax",
        },
        {
            "name": "sep_becario_sidebar",
            "value": "open",
            "domain": "www.programaexcelencia.org",
            "path": "/",
            "sameSite": "Lax",
        },
    ]
    if args.csrf_token:
        cookies.append(
            {
                "name": "__Host-next-auth.csrf-token",
                "value": args.csrf_token,
                "domain": "www.programaexcelencia.org",
                "path": "/",
                "secure": True,
                "sameSite": "Lax",
            }
        )

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        ctx.add_cookies(cookies)
        page = ctx.new_page()
        print(f"[fetch] abriendo {args.url}")
        page.goto(args.url, wait_until="networkidle")

        print("[fetch] click en boton de lista completa...")
        btn = page.locator(
            'button:has(svg path[d^="M3.75 3.75v4.5"])'
        ).first
        btn.click()
        # Esperar a que aparezcan muchas filas (la tabla grande). Si la lista
        # es mas pequena que el umbral, se continua igualmente tras el timeout.
        try:
            page.wait_for_function(
                f"document.querySelectorAll('img[src*=\"blobstoragex9083\"]').length >= {args.wait_rows}",
                timeout=60000,
            )
        except Exception:  # noqa: BLE001
            print(
                f"[fetch] aviso: no se alcanzaron {args.wait_rows} fotos; "
                "continuando con lo disponible."
            )
        # Dar un respiro para que terminen de montarse todas las filas.
        page.wait_for_timeout(3000)
        html = page.content()
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(html)
        count = html.count("blobstoragex9083")
        print(f"[fetch] HTML guardado en {args.out} ({count} refs a fotos)")
        browser.close()


if __name__ == "__main__":
    main()
