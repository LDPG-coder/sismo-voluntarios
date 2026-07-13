# Integración SISMO ⇄ SEP

Cómo conectar el login y la base de usuarios de SEP con la aplicación de
Voluntarios (SISMO), cuando **SEP y SISMO viven en dominios distintos** y se
quiere **minimizar el cambio del lado de SEP** (toda la lógica queda en SISMO).

> Estado: implementado en la rama `feat/sep-integration`. Ver
> `docs/SEP_INTEGRATION.md` (este archivo) y el diff de esa rama.

---

## 1. Visión general y por qué este diseño

SEP autentica a sus propios usuarios. En vez de que SEP exponga su base de
datos o firme tokens, **SEP solo hace una llamada server-to-server a SISMO**
y SISMO le devuelve un **código de un solo uso (one-time code)**. SEP redirige
el navegador a SISMO con ese código; SISMO lo canjea por una cookie de sesión
normal (la misma maquinaria que ya usa Google OAuth).

Por qué es la mejor opción para dominios distintos:

- **Máxima seguridad**: el navegador nunca porta un credencial de SEP de larga
  vida; solo un código de un uso y TTL corto (`SISMO_OAUTH_EXCHANGE_TTL_SECONDS`,
  default 300s). El secreto solo lo conoce SISMO.
- **Casi tan rápido como el proxy-headers**: el único costo extra es una
  llamada backend en el login; después, la sesión es una cookie HMAC firmada
  igual que la de Google.
- **Mínimo cambio en SEP**: SEP no necesita firmar JWT, no comparte dominio y
  no aloja lógica de SISMO. Solo necesita un endpoint que llame a SISMO y
  redirija.
- **Poblaciones separadas**: los usuarios de SEP se auto-provisionan en SISMO
  (`auth_source = "sep"`) y jamás se mezclan con las cuentas de Google.

### Flujo

```
SEP (backend)                SISMO (API)                Navegador
     |  POST /auth/sep-login  |                          |
     |  Authorization: Bearer |                          |
     |  {sep_user_id,email,...}|                          |
     |------------------------>|  upsert User(auth_source=sep)
     |     { code }            |                          |
     |<------------------------|                          |
     |  redirect /auth/sep?code=code                     |
     |-------------------------------------------------->|  POST /auth/exchange
     |                          |<------------------------- {user_id,role,status}
     |  Set-Cookie sismo_session (firmada HMAC)          |
     |<--------------------------------------------------|  -> app embebida (sin header/sidebar)
```

---

## 2. Para el desarrollador de Voluntarios (SISMO)

### 2.1 Endpoints y contratos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/v1/auth/sep-login` | `Bearer <SISMO_SEP_API_TOKEN>` | SEP canjea la identidad de un usuario por un one-time code. |
| `POST` | `/api/v1/auth/exchange` | — | Canjea el code por `{user_id, role, status}` (ya existía para Google OAuth). |
| `GET`  | `/api/v1/auth/me` | cookie de sesión | Devuelve el usuario, ahora incluye `auth_source`. |

#### `POST /api/v1/auth/sep-login`

Header obligatorio: `Authorization: Bearer <SISMO_SEP_API_TOKEN>`
Cuerpo:
```json
{ "sep_user_id": "string", "email": "string", "name": "string | null", "role": "volunteer | admin | null" }
```
Respuesta `200`:
```json
{ "code": "<one-time-code>" }
```
Errores: `401 auth.sep_token_invalid` (token malo), `401 auth.sep_unauthorized`
(token no configurado en SISMO), `422` (faltan `sep_user_id`/`email`).

El endpoint hace **upsert** por `sep_user_id`: si ya existe, actualiza
`email`/`name`/`role`; si no, crea el usuario con `auth_source="sep"`,
`status="active"` y un `referral_code`. Nunca enlaza por email, para mantener
las poblaciones separadas.

### 2.2 Variables de entorno

En `apps/api` (ver `.env.example`):
```
SISMO_SEP_API_TOKEN=        # secreto compartido solo SISMO<->backend SEP. Generar: openssl rand -hex 32
```
Dejarlo vacío deshabilita el login SEP. El TTL del code usa
`SISMO_OAUTH_EXCHANGE_TTL_SECONDS` (default 300).

### 2.3 Cambios en la base de datos

Migración `apps/api/alembic/versions/010_add_user_auth_source.py`:
- `users.auth_source` (`google` | `sep`, default `google`)
- `users.sep_user_id` (único, nullable)

Aplicar con `alembic upgrade head` en el despliegue.

### 2.4 Dos modos de la app (UI)

- **Modo SEP** (`auth_source == "sep"` o contexto `sep`): se renderiza
  `EmbeddedShell` (sin header/sidebar de SISMO; usa el panel flotante
  `FloatingNav`). El switch está en `apps/web/app/(app)/layout.tsx`.
- **Modo público** (Google/external): `AppShell` completo, pero con
  restricciones (ver abajo).

### 2.5 Restricciones de la versión pública

Implementadas en el backend (fuente de verdad), keyed en
`user.auth_source != "sep" and user.role != "admin"`:
- `POST /activities` → `403` (no puede crear actividades, solo unirse).
- `GET /users/directory` (usa "ceder cupo") → `403`.
- `POST /activities/{id}/transfer` (ceder cupo) → `403`.

En el frontend se oculta el botón "Crear actividad" para esos usuarios
(`app-shell.tsx`, `nav-bar.tsx`, `mis-actividades-client.tsx`).

> Nota de diseño: permití que los **admins** (rol `admin`) también creen, para
> no romper el flujo actual de staff. Si quieres que *ningún* no-SEP cree,
> cambia la condición a `user.auth_source != "sep"` en los tres endpoints.

### 2.6 Cómo verificar (local)

El stack completo ya corre con `docker compose` en `infra/`. Para probar SEP
sin el backend real de SEP, basta un `curl`:

```bash
# token malo -> 401
curl -X POST localhost:8000/api/v1/auth/sep-login \
  -H "Authorization: Bearer wrong" -H "Content-Type: application/json" \
  -d '{"sep_user_id":"s1","email":"a@sep.bo","name":"Ana"}'

# token bueno -> {code}
CODE=$(curl -s -X POST localhost:8000/api/v1/auth/sep-login \
  -H "Authorization: Bearer $SISMO_SEP_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"sep_user_id":"s1","email":"a@sep.bo","name":"Ana"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['code'])")

# el navegador iria a /auth/sep?code=$CODE; la ruta web setea la cookie.
```

Para probar restricciones, firmar una cookie de sesión con `SISMO_SESSION_SECRET`
(mismo formato que `apps/web/lib/auth/cookie.ts`) y llamar `POST /activities`.

---

## 3. Para el desarrollador de SEP

**Tu únicas responsabilidades:** (1) tener el `SISMO_SEP_API_TOKEN` compartido,
(2) hacer UNA llamada HTTP server-to-side a SISMO cuando un usuario SEP logueado
deba entrar a Voluntarios, y (3) redirigir el navegador a SISMO con el code.
Nada de firmar tokens, nada de compartir dominio, nada de tocar tu BD.

### 3.1 Pasos

1. Solicita a SISMO el valor de `SISMO_SEP_API_TOKEN` (secreto compartido).
   Guárdalo como secreto de tu backend, nunca lo expongas al browser.
2. Cuando un usuario autenticado en SEP deba abrir Voluntarios, tu backend:
   a. Llama `POST https://<SISMO_API>/api/v1/auth/sep-login` con el header
      `Authorization: Bearer <SISMO_SEP_API_TOKEN>` y el cuerpo con la
      identidad del usuario (`sep_user_id` estable y único en SEP, `email`,
      `name`, y opcionalmente `role`).
   b. Toma el `code` de la respuesta.
   c. Redirige el navegador a `https://<SISMO_WEB>/auth/sep?code=<code>`.
3. SISMO setea la cookie de sesión y muestra la app en modo embebido.

Eso es todo. El resto (sesión, restricciones, UI embebida) lo maneja SISMO.

### 3.2 Ejemplo (pseudocódigo, stack-agnóstico)

```
POST https://api.sismo.lat/api/v1/auth/sep-login
Headers: Authorization: Bearer <SISMO_SEP_API_TOKEN>
         Content-Type: application/json
Body:    { "sep_user_id": sepUser.id,
           "email": sepUser.email,
           "name": sepUser.displayName }

-> 200 { "code": "..." }

HTTP 302 -> https://app.sismo.lat/auth/sep?code=<code>
```

### 3.3 Ejemplo Python (Flask/FastAPI/Django)

```python
import os, requests
SISMO_API = os.environ["SISMO_API_URL"]          # https://api.sismo.lat
SEP_TOKEN  = os.environ["SISMO_SEP_API_TOKEN"]   # secreto compartido

def entrar_a_sismo(sep_user):
    r = requests.post(
        f"{SISMO_API}/api/v1/auth/sep-login",
        headers={"Authorization": f"Bearer {SEP_TOKEN}"},
        json={
            "sep_user_id": str(sep_user["id"]),   # estable y único en SEP
            "email": sep_user["email"],
            "name": sep_user.get("name"),
            # "role": "admin"  # opcional
        },
        timeout=10,
    )
    r.raise_for_status()
    code = r.json()["code"]
    return f"https://app.sismo.lat/auth/sep?code={code}"
# devuélvelo como redirect (302) al navegador
```

### 3.4 Ejemplo Node/TypeScript

```ts
const SISMO_API = process.env.SISMO_API_URL!;      // https://api.sismo.lat
const SEP_TOKEN = process.env.SISMO_SEP_API_TOKEN!; // secreto compartido

export async function sismoLoginUrl(sepUser: {
  id: string; email: string; name?: string;
}): Promise<string> {
  const res = await fetch(`${SISMO_API}/api/v1/auth/sep-login`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SEP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sep_user_id: String(sepUser.id),
      email: sepUser.email,
      name: sepUser.name ?? null,
    }),
  });
  if (!res.ok) throw new Error(`sep-login falló: ${res.status}`);
  const { code } = (await res.json()) as { code: string };
  return `https://app.sismo.lat/auth/sep?code=${code}`;
}
// redirige (302) el navegador a esa URL
```

### 3.5 Cómo mantener la integración compatible (a prueba de futuro)

- **No acoples SEP a detalles de SISMO.** Solo depende de: la URL del
  endpoint, el header `Authorization: Bearer`, la forma del body y el redirect
  a `/auth/sep?code=`. No leas ni escribas cookies de SISMO, no inyectes
  headers personalizados en SISMO, no asumas el dominio.
- **`sep_user_id` debe ser estable y único** en SEP (un UUID o PK de tu tabla
  de usuarios). Si cambia, SISMO crearía una cuenta nueva.
- **El code es de un solo uso y caduca** (~5 min). No lo caches ni lo reutilices;
  pide uno nuevo por cada intento de login.
- **Si SISMO cambia de dominio**, solo actualiza `SISMO_API_URL` /
  `SISMO_WEB_URL` en tu config; el contrato HTTP no cambia.
- **Versión del contrato**: el body actual es estable. Si SISMO añade campos
  (p.ej. `role`), son opcionales y no rompen tu cliente.
- **HTTPS always** en producción (la cookie de sesión lleva `Secure`).

### 3.6 Variantes (si en el futuro SEP y SISMO comparten dominio/proxy)

Si SISMO queda detrás del reverse proxy de SEP en el mismo origen del browser,
SISMO puede en cambio aceptar **headers inyectados por el proxy**
(`x-sismo-context: sep` + identidad) y ahorrarse el redirect. Eso requiere
configurar el proxy de SEP y validar un secreto de proxy en SISMO; es el
enfoque "proxy-headers" (más rápido, pero más superficie de confianza). Por
ahora se eligió el de one-time code porque no depende del dominio ni del proxy.

---

## 4. Seguridad

- El `SISMO_SEP_API_TOKEN` es un secreto compartido: solo vive en los backends
  de SEP y SISMO, nunca en el browser ni en el repo.
- El one-time code es de un uso y TTL corto; no es un credential de sesión.
- La sesión resultante es la cookie HMAC firmada existente (`SISMO_SESSION_SECRET`),
  idéntica a la de Google OAuth.
- Las restricciones de la versión pública se aplican en el backend, no solo en
  la UI, así que no se evaden desactivando JS.
