# Integración SISMO ⇄ SEP — Cookbook y contrato

Documento complementario de `docs/SEP_INTEGRATION.md`. Contiene los bloques de
código para integrar: los **cambios en SISMO** y lo que debe implementar el
**servidor de SEP**.

**Mecanismo principal elegido: Proxy reverso (full-page).** SISMO se sirve como
su propia app Next en la subruta `/voluntarios` del dominio de SEP; SEP solo
agrega un enlace en su menú y configura un reverse proxy. La identidad se entrega
vía header HMAC firmado (§A, §B.1–B.3, §C.1–C.4). Ver `docs/SEP_INTEGRATION.md`
para el razonamiento y responsabilidades paso a paso.

El **Micro-frontend (Module Federation)** se evaluó y **se descartó** porque no
es compatible con el App Router de Next 15 (ver apéndice en
`SEP_INTEGRATION.md`). Las recetas MF quedan abajo solo como referencia
histórica.

---

## A. Contrato del header de identidad SEP

SEP firma la identidad del usuario autenticado y la inyecta en cada request que
hace al subpath de SISMO.

**Headers:**

```
x-sismo-sep-user: <BASE64URL( JSON({
    "sep_user_id": "uuid-o-pk-estable-de-sep",
    "email": "usuario@sep.org",
    "name": "Nombre Apellido",
    "role": "admin" | "volunteer" | null
}) )>

x-sismo-sep-sig: <HMAC_SHA256( valor_de_x-sismo-sep-user , SISMO_SEP_PROXY_SECRET )>
```

- Algoritmo: `HMAC-SHA256`, hex.
- La firma se calcula sobre el **valor textual** del header `x-sismo-sep-user`
  (sin el prefijo del nombre de header), usando `SISMO_SEP_PROXY_SECRET`
  compartido solo entre el proxy de SEP y la API de SISMO.
- SISMO verifica con `hmac.compare_digest` (evita timing attacks). Si falla,
  ignora el header (el usuario caería en flujo de no-autenticado / login).
- `sep_user_id` debe ser **estable y único** en SEP (PK o UUID). Si cambia,
  SISMO crearía otra cuenta.

---

## B. Cambios en SISMO (bloques para pegar)

### B.1 `apps/api/app/core/config.py`

```python
# Secreto compartido proxy<->API para firmar la identidad inyectada por SEP.
sep_proxy_secret: str | None = None
```

### B.2 `apps/api/app/pipeline/sep_proxy.py` (nuevo)

```python
import base64, hashlib, hmac, json, uuid
from dataclasses import dataclass

from app.core.config import settings
from app.api.v1.auth import _resolve_or_create_sep_user
from app.pipeline.session import SessionPayload, encode_session


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify_sep_proxy_header(user_b64: str | None, sig: str | None) -> dict | None:
    if not user_b64 or not sig or not settings.sep_proxy_secret:
        return None
    expected = hmac.new(
        settings.sep_proxy_secret.encode(), user_b64.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        identity = json.loads(_b64url_decode(user_b64))
        if not identity.get("sep_user_id"):
            return None
        return identity
    except Exception:
        return None


def issue_sep_session(db, identity: dict) -> tuple[object, str]:
    """Upsert del usuario SEP y emisión de la cookie de sesión de SISMO."""
    user = _resolve_or_create_sep_user(
        db,
        sep_user_id=str(identity["sep_user_id"]),
        email=identity.get("email") or "",
        name=identity.get("name"),
        role=identity.get("role"),
    )
    payload = SessionPayload(
        user_id=user.id, role=user.role.value, status=user.status.value
    )
    cookie = encode_session(settings, payload)  # firma con SISMO_SESSION_SECRET
    return user, cookie
```

### B.3 Integración en el resolve de sesión

En `apps/api/app/pipeline/session.py`, antes de rechazar por "no autenticado",
intenta el header de SEP:

```python
from app.pipeline import sep_proxy as sep_proxy

def resolve_session(request, db):
    user = verify_session_from_cookie(request)   # lógica actual (HMAC cookie)
    if user is not None:
        return user
    identity = sep_proxy.verify_sep_proxy_header(
        request.headers.get("x-sismo-sep-user"),
        request.headers.get("x-sismo-sep-sig"),
    )
    if identity:
        user, cookie = sep_proxy.issue_sep_session(db, identity)
        request.state.set_session_cookie = cookie   # la API lo envía en Set-Cookie
        return user
    return None  # -> 401 como hoy
```

> El mecanismo de cookie (`encode_session`/`verify_session`) ya existe y usa
> `SISMO_SESSION_SECRET`; el proxy model lo reusa sin cambios de formato.

### B.4 Partner API — `apps/api/app/api/v1/partner.py` (IMPLEMENTADA)

> **Estado:** implementada y registrada en `app/api/v1/router.py`. SEP la
> consulta server-to-server con `Authorization: Bearer <SISMO_SEP_API_TOKEN>`.
> El código real en el repo es el de abajo (equivalente a esta receta, usa
> `compare_digest` y `auth.sep_unauthorized` cuando el token no está configurado).

```python
from fastapi import APIRouter, Depends, Header
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, ErrorCode
from app.db.base import get_db
from app.db.models import Notification, User

router = APIRouter(prefix="/partner/v1", tags=["partner"])


def require_sep_partner_token(
    authorization: str = Header(None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.sep_api_token:
        raise ApiError(ErrorCode.auth_sep_unauthorized, "SEP partner API not configured")
    expected = f"Bearer {settings.sep_api_token}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise ApiError(ErrorCode.auth_sep_token_invalid, "invalid SEP API token")


@router.get("/users/{sep_user_id}/notifications/summary")
def partner_notifications_summary(
    sep_user_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_sep_partner_token),
) -> dict:
    user = db.execute(select(User).where(User.sep_user_id == sep_user_id)).scalar_one_or_none()
    if not user:
        return {"unread": 0, "items": []}
    unread = db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user.id, Notification.read.is_(False)
        )
    ).scalar() or 0
    notifs = db.execute(
        select(Notification).where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc()).limit(20)
    ).scalars().all()
    return {
        "unread": unread,
        "items": [
            {
                "id": str(n.id), "type": n.type, "title": n.title,
                "message": n.message, "activity_id": str(n.activity_id) if n.activity_id else None,
                "read": n.read, "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifs
        ],
    }
```

Registrada en `app/api/v1/router.py` con `api_v1_router.include_router(partner_router)`.

### B.5 Web — `apps/web/next.config.ts` (VARIANTE PROXY REVERSO)

Esta es la config para el proxy reverso:

```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/voluntarios",
};
export default nextConfig;
```

Y en el `.env` del web en el server SEP:

```
NEXT_PUBLIC_API_URL=https://sep.org/voluntarios/api
NEXT_PUBLIC_WEB_ORIGIN=https://sep.org
SEP_EMBED=1
```

### B.5b (DEPRECADO) Variante Micro-frontend — referencia histórica

> **Descartada.** Esta variante no es viable mientras SISMO use **App Router**
> (Next 15): `@module-federation/nextjs-mf` da `App Directory is not supported`
> y el plugin plano `@module-federation/enhanced` no resuelve `react-dom/client`.
> Ver el apéndice de `SEP_INTEGRATION.md`. Se adoptó el **proxy reverso** (§B.5
> arriba) en su lugar. Se deja constancia de lo intentado:
>
> - `next.config.ts` usaba `NextFederationPlugin` exponiendo `./SismoApp` desde
>   `app/(app)/sismo-app.tsx` (un `SismoApp` que montaba `EmbeddedShell` sin
>   chrome propio y redimía un `code` vía `SEPUserProvider`).

No implementar esta variante.

### B.6 API expuesta bajo `/voluntarios/api` (VARIANTE PROXY REVERSO)

La API FastAPI debe escuchar en esa ruta. Opciones:
- `uvicorn app.main:app --root-path /voluntarios/api`, o
- el proxy de SEP hace `rewrite` de `/voluntarios/api` → `/api` antes de llegar
  a SISMO.

La API se sirve mismo-origen (mismo `NEXT_PUBLIC_API_URL`) para que la cookie
de sesión de SISMO sea first-party y no haya CORS.

---

## C. Lado SEP (pseudocódigo, stack-agnóstico)

### C.1 Firmar e inyectar la identidad en el proxy

El proxy de SEP, **solo si el usuario tiene sesión SEP**, arma e inyecta los
headers. Ejemplo en Python (puedes portarlo a tu proxy/backend):

```python
import base64, hashlib, hmac, json

SEP_PROXY_SECRET = os.environ["SISMO_SEP_PROXY_SECRET"]  # compartido con SISMO

def make_sep_identity_headers(user) -> dict:
    payload = {
        "sep_user_id": str(user["id"]),
        "email": user["email"],
        "name": user.get("name"),
        "role": user.get("role"),
    }
    user_b64 = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    sig = hmac.new(SEP_PROXY_SECRET.encode(), user_b64.encode(), hashlib.sha256).hexdigest()
    return {"x-sismo-sep-user": user_b64, "x-sismo-sep-sig": sig}
```

Config del proxy (nginx/Caddy) — se inyectan los headers en las requests al
subpath `/voluntarios`. El proxy llama a `make_sep_identity_headers` (o su
equivalente) usando la sesión SEP ya validada, y **no** las inyecta en las rutas
de login/OAuth de SISMO.

### C.2 Rutas en el proxy de SEP

```
/voluntarios            -> SISMO web   (inyectar header si hay sesión SEP)
/voluntarios/api        -> SISMO api   (inyectar header si hay sesión SEP)
/voluntarios/login*     -> SISMO web   (SIN auth SEP: es para usuarios externos)
/voluntarios/api/v1/auth/* -> SISMO api (SIN auth SEP: login Google/OAuth)
```

### C.3 Backend de SEP: campana en el header general

El backend de SEP, para el usuario actual, consulta la Partner API de SISMO y
pinta la campana en el header que SEP ya usa en todo el sitio:

```python
import os, requests

SISMO_API = os.environ["SISMO_API_URL"]          # https://sep.org/voluntarios/api
SEP_TOKEN  = os.environ["SISMO_SEP_API_TOKEN"]   # mismoBearer que SISMO

def sismo_notifications_for(sep_user_id: str) -> dict:
    r = requests.get(
        f"{SISMO_API}/partner/v1/users/{sep_user_id}/notifications/summary",
        headers={"Authorization": f"Bearer {SEP_TOKEN}"},
        timeout=3,
    )
    return r.json() if r.ok else {"unread": 0, "items": []}
```

Renderizas el badge (count de `unread`) en el header de SEP igual que tus otras
notificaciones. Al hacer clic, puedes enlazar a `/voluntarios` (la subpágina de
SISMO) o a un panel de notificaciones que consuma
`/partner/v1/users/{sep_user_id}/notifications`.

### C.4 Logout

En el logout global de SEP, además de limpiar la sesión SEP, borra la cookie
`sismo_session` (mismo origen `sep.org`, SEP puede hacer `Set-Cookie` con
`Max-Age=0` o `Expires` pasado). Así SISMO queda también deslogueado.

### C.7 (DEPRECADO) Host SEP (Micro-frontend) — referencia histórica

> **Descartada** a favor del proxy reverso (§C.1–C.4). Se dejaba constancia de
> que, en MF, SEP habría montado `./SismoApp` en su shell y entregado la
> identidad vía `sep-login` (one-time `code`), no por header HMAC. No aplicable
> con App Router de Next 15.

El header de SEP (campana) se alimenta igual que en §C.3, vía Partner API
server-to-server.

---

## D. Contrato Partner API (resumen)

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| `GET` | `/partner/v1/users/{sep_user_id}/notifications/summary` | `Bearer <SISMO_SEP_API_TOKEN>` | `{ "unread": int, "items": [...] }` |
| `GET` | `/partner/v1/users/{sep_user_id}/notifications` | `Bearer <SISMO_SEP_API_TOKEN>` | `[ { id, type, title, message, activity_id, read, created_at } ]` |

- Errores: `401 auth.sep_token_invalid` (token ausente/inválido), `404` si el
  `sep_user_id` no existe en SISMO (la app devuelve `{unread:0,items:[]}` para
  no romper el header).
- `sep_user_id` es el identificador estable de SEP del usuario (el mismo que
  SEP firma en `x-sismo-sep-user`).

---

## E. Checklist de verificación (Proxy reverso — VÍA ADOPTADA)

> SISMO es su propio Next App Router servido en `/voluntarios` del dominio de
> SEP. Compatible con App Router; no requiere MF. (El checklist MF quedó
> descartado; ver apéndice de `SEP_INTEGRATION.md`.)

- [ ] SISMO API: `SISMO_SEP_PROXY_SECRET` configurado igual que en el proxy SEP.
- [ ] `x-sismo-sep-user`/`x-sismo-sep-sig` verificados (firma HMAC correcta, receta B.1–B.3).
- [ ] Usuario SEP entra a `/voluntarios` → sesión de SISMO emitida, sin login.
- [ ] Usuario externo → login Google de SISMO funciona (proxy no inyecta header en login).
- [ ] Logout de SEP limpia `sismo_session`.
- [ ] `basePath: "/voluntarios"` y `NEXT_PUBLIC_API_URL` apuntan al mismo origen.
- [ ] SEP agrega enlace "Voluntariados" en su sidebar y proxy `/voluntarios*` → SISMO.
- [ ] Header de SEP muestra `unread` desde la Partner API.
- [ ] SISMO usa su propia BD; usuarios `auth_source=sep`.
