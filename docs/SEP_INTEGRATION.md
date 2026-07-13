# Integración SISMO ⇄ SEP — SISMO como subpágina de SEP (mismo origen)

> **Modelo elegido:** SISMO (API + web + postgres + redis) corre como contenedores
> en el servidor de SEP y se sirve como **subruta tras el reverse proxy de SEP**
> (p.ej. `https://sep.org/voluntarios`). SEP inyecta la identidad de sus usuarios
> internos firmada por header; los usuarios externos usan el login propio de
> SISMO. SISMO mantiene su propia BD/lógica y sincroniza lo necesario de los
> usuarios SEP. Las notificaciones se muestran en el header general de SEP vía
> API server-to-server.
>
> Este documento **reemplaza** el enfoque previo de `<iframe>` cross-site. En el
> despliegue de mismo origen no se necesitan CORS ni `frame-ancestors`.

---

## 1. Topología de despliegue

```
                         sep.org  (mismo origen, reverse proxy de SEP)
   ┌──────────────────────────────────────────────────────────────┐
   │  SEP (su propio sitio/app)  │  /voluntarios  →  SISMO web       │
   │                             │  /voluntarios/api →  SISMO api     │
   └─────────────────────────────┼──────────────────────────────────┘
                                  │ proxy inyecta headers firmados
        SISMO (contenedores en server SEP):
          web (Next.js)  ·  api (FastAPI)  ·  postgres (BD propia)  ·  redis
```

- SISMO se despliega con `basePath: "/voluntarios"` (Next.js) y la API bajo
  `/voluntarios/api`. El browser siempre habla con **el mismo origen**
  `sep.org`, así que las cookies de sesión (`sismo_session`) son first-party y
  no hay problemas de `SameSite` ni CORS.
- SISMO usa **su propia base de datos** (una BD separada dentro de la instancia
  postgres de SEP, o la que SEP provea) y su propio redis. No comparte esquema
  con SEP.

---

## 2. Identidad y autenticación

### 2.1 Usuarios internos de SEP (sin re-login)

Cuando un usuario ya autenticado en SEP entra a `/voluntarios`, el proxy de SEP
inyecta en la request dos headers firmados:

```
x-sismo-sep-user: <base64url(json({ "sep_user_id", "email", "name", "role" }))>
x-sismo-sep-sig:  <hmac_sha256(x-sismo-sep-user, SISMO_SEP_PROXY_SECRET)>
```

La API de SISMO valida la firma HMAC y, si es válida, **emite/refresca la cookie
de sesión de SISMO** (`sismo_session`, firmada con `SISMO_SESSION_SECRET`) para
ese usuario SEP. A partir de ahí, el resto de la app funciona igual que hoy
(lectura de `/auth/me`, etc.). No hay pantalla de login de SISMO para estos
usuarios.

**Logout:** es el logout de SEP. SEP debe, al cerrar sesión, también limpiar la
cookie `sismo_session` (mismo origen, SEP puede hacerlo). SISMO trata la
ausencia de sesión + ausencia de header como "no autenticado".

### 2.2 Usuarios externos (login propio de SISMO)

Los usuarios sin cuenta SEP ( voluntarios externos) se loguean con el mecanismo
propio de SISMO (Google OAuth). El proxy de SEP debe dejar pasar las rutas de
login/OAuth de SISMO **sin** exigir sesión de SEP (p.ej. excluir
`/voluntarios/login`, `/voluntarios/api/v1/auth/*` del requisito de auth de SEP).

---

## 3. Qué cambia en el código actual de SISMO

### 3.1 Config (`apps/api/app/core/config.py`)

Agregar el secreto del proxy (distinto al `SISMO_SEP_API_TOKEN`, que sigue para
la API server-to-server de notificaciones):

```python
# Secreto compartido solo entre el proxy de SEP y la API de SISMO para firmar
# la identidad inyectada (x-sismo-sep-user / x-sismo-sep-sig).
sep_proxy_secret: str | None = None
```

### 3.2 Validación del header y emisión de sesión

Nuevo módulo `apps/api/app/pipeline/sep_proxy.py`:

```python
import base64, hashlib, hmac, json, uuid
from app.core.config import settings
from app.api.v1.auth import _resolve_or_create_sep_user  # reusa el upsert SEP
from app.pipeline.session import encode_session

def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def verify_sep_proxy_header(user_b64: str | None, sig: str | None) -> dict | None:
    """Devuelve el dict de identidad si la firma HMAC es válida, sino None."""
    if not user_b64 or not sig or not settings.sep_proxy_secret:
        return None
    expected = hmac.new(
        settings.sep_proxy_secret.encode(), user_b64.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        return json.loads(_b64url_decode(user_b64))
    except Exception:
        return None

def resolve_sep_session(db, identity: dict):
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
    return user, cookie  # Set-Cookie en la respuesta
```

La API necesita un punto donde, al recibir un header válido y no tener sesión,
emita la cookie. La forma mínima es un middleware/dependencia que se ejecuta
antes de `require_session`:

```python
# En app/pipeline/session.py (o un middleware de la API):
def resolve_session(request, db):
    user = verify_session_from_cookie(request)        # lógica actual
    if user is None:
        identity = verify_sep_proxy_header(
            request.headers.get("x-sismo-sep-user"),
            request.headers.get("x-sismo-sep-sig"),
        )
        if identity:
            user, cookie = resolve_sep_session(db, identity)
            request.state.new_session_cookie = cookie  # la API la envía en Set-Cookie
    return user
```

> Nota: `encode_session` y `verify_session` ya existen en
> `app/pipeline/session.py` y usan `SISMO_SESSION_SECRET`. El proxy model las
> reusa tal cual: la API firma y verifica su propia cookie.

### 3.3 Web: siempre modo embebido (SEP provee el chrome)

Como SISMO es una subpágina de SEP, debe renderizar `EmbeddedShell`
(sin header/sidebar propios). Basta setear la env `SEP_EMBED=1` en este
despliegue: `getEmbedContext()` (`apps/web/lib/auth/embed.ts`) ya devuelve
`"sep"` con esa env. Opcionalmente el proxy puede enviar `x-sismo-context: sep`
(también soportado).

### 3.4 Web: subruta y API mismo origen

`apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/voluntarios",          // SISMO se sirve en sep.org/voluntarios
};
export default nextConfig;
```

Variables de entorno del web (en el `.env` de SISMO en el server SEP):

```
NEXT_PUBLIC_API_URL=https://sep.org/voluntarios/api   # mismo origen
NEXT_PUBLIC_WEB_ORIGIN=https://sep.org
SEP_EMBED=1
```

La API (FastAPI) se expone en `/voluntarios/api`, p.ej. con
`--root-path /voluntarios/api` o detrás del proxy que hace rewrite.

### 3.5 CORS / frame-ancestors

Como es **mismo origen**, no se necesitan. `SISMO_API_CORS_ORIGINS` puede quedar
en el origen de SEP (o `*` en este despliegue controlado). El CSP
`frame-ancestors` del `middleware.ts` no aplica (no hay iframe).

---

## 4. Datos

- SISMO lleva su **propia base de datos** (postgres). Se recomienda una BD
  separada dentro de la instancia de postgres de SEP (`SISMO_DB_NAME=sismo_sep`
  apuntando al server de SEP) para no acoplar esquemas.
- Al validar el header, SISMO hace upsert de `User` con `auth_source="sep"` y
  `sep_user_id` (reusa `_resolve_or_create_sep_user`). SISMO guarda en su propia
  tabla los campos extra que SEP no maneja (p.ej. `referral_code`, estado de
  voluntario, asistencia). La identidad canónica (nombre/email/rol) viene del
  header de SEP.
- Los usuarios externos siguen siendo `auth_source="google"` y se manejan con la
  lógica separada que ya existe.

---

## 5. Notificaciones en el header de SEP (server-to-server)

SEP muestra las notificaciones de SISMO en su header general. Para eso SISMO
expone una **Partner API** autenticada con `SISMO_SEP_API_TOKEN` (Bearer), que
el backend de SEP consulta por el `sep_user_id` del usuario actual.

Endpoints (ver `docs/SEP_INTEGRATION_LONGTERM.md` para el contrato completo):

```
GET /partner/v1/users/{sep_user_id}/notifications/summary
   Authorization: Bearer <SISMO_SEP_API_TOKEN>
   -> { "unread": <int>, "items": [ ... ] }

GET /partner/v1/users/{sep_user_id}/notifications
   Authorization: Bearer <SISMO_SEP_API_TOKEN>
   -> [ { id, type, title, message, activity_id, read, created_at } ]
```

El backend de SEP las consume y pinta la campana en su header (ver pseudocódigo
en el doc largo).

---

## 6. Qué debe enviar y recibir el servidor de SEP

**SEP envía a SISMO** (inyectado por su proxy, en cada request al subpath, para
usuarios autenticados en SEP):

| Header | Contenido | Firma |
|---|---|---|
| `x-sismo-sep-user` | base64url(json identidad SEP) | — |
| `x-sismo-sep-sig` | HMAC-SHA256 del valor anterior con `SISMO_SEP_PROXY_SECRET` | HMAC |

**SEP recibe de SISMO** (vía su backend, server-to-server):

- Resumen/lista de notificaciones del usuario SEP (`/partner/v1/...`), para el
  header de SEP.

**SEP debe además:**
- Enrutar `/voluntarios` → web y `/voluntarios/api` → api de SISMO.
- Excluir las rutas de login/OAuth de SISMO del requisito de auth de SEP.
- Limpiar `sismo_session` en su logout global.

---

## 7. Variables de entorno (SISMO en server SEP)

| Variable | Dónde | Valor |
|---|---|---|
| `SISMO_SESSION_SECRET` | api+web | secreto de firma de cookie (existente) |
| `SISMO_SEP_API_TOKEN` | api | Bearer de la Partner API (existente) |
| `SISMO_SEP_PROXY_SECRET` | api | **nuevo**: firma de `x-sismo-sep-user` (compartido con proxy SEP) |
| `SEP_EMBED` | web | `1` (siempre modo embebido) |
| `NEXT_PUBLIC_API_URL` | web | `https://sep.org/voluntarios/api` |
| `NEXT_PUBLIC_WEB_ORIGIN` | web | `https://sep.org` |
| `SISMO_DB_*` | api | apunta a la instancia postgres de SEP (BD separada) |

---

## 8. Pasos de despliegue (resumen)

1. SISMO: añadir `sep_proxy_secret` a config; crear `pipeline/sep_proxy.py`;
   cablear la validación de header en el resolve de sesión; Partner API.
2. Web: `basePath: "/voluntarios"`, `SEP_EMBED=1`, `NEXT_PUBLIC_API_URL` mismo
   origen.
3. SEP: proxy que inyecta `x-sismo-sep-user`/`x-sismo-sep-sig`; rutas
   `/voluntarios*`; excluir login/OAuth de SISMO del auth de SEP; limpiar
   `sismo_session` en logout.
4. SEP: backend que consulta la Partner API y pinta la campana en su header.
5. Verificar: usuario SEP entra a `/voluntarios` → sin login → ve sus
   actividades; usuario externo → login Google; logout SEP limpia sesión.
