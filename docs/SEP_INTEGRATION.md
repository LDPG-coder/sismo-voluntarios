# Integración SISMO ⇄ SEP — Enfoque de corto plazo (MVP funcional)

> **Horizonte: corto plazo.** Esta es la solución inmediata, ya implementada y
> mergeada a `main`, pensada para tener SEP y SISMO integrados rápido con mínimo
> cambio del lado de SEP. Para el plan de evolución hacia una arquitectura más
> óptima y **desacoplada** (server-to-server, webhooks, SSO estándar,
> micro-frontend), ver [`docs/SEP_INTEGRATION_LONGTERM.md`](./SEP_INTEGRATION_LONGTERM.md).
> Esa evolución se aborda **después** de que esta integración primaria funcione.

Cómo conectar la **autenticación** de SEP con la app de Voluntarios (SISMO) y
cómo **embeber SISMO dentro del propio sitio de SEP**, cuando SEP y SISMO viven
en dominios distintos y se quiere minimizar el cambio del lado de SEP (toda la
lógica queda en SISMO).

> Estado: implementado y mergeado a `main`. Ver `docs/SEP_INTEGRATION.md` (este
> archivo). Código relevante: `apps/api/app/api/v1/*`, `apps/web/lib/auth/*`,
> `apps/web/app/(app)/layout.tsx`, `apps/web/components/*`.

Hay dos partes independientes:

1. **Login federado** (server-to-server, un solo endpoint) — SEP redirige al
   navegador a SISMO para autenticar.
2. **Modo embebido** — SEP abre una sección que carga SISMO en un `<iframe>`;
   SEP mantiene su propio header/sidebar y SISMO renderiza `EmbeddedShell`
   (navegación flotante, sin chrome de SISMO). Incluye sincronización de tema y
   una campana de notificaciones en el header de SEP.

---

## 1. Login federado (server-to-server)

SEP autentica a sus propios usuarios. En vez de exponer su BD o firmar tokens,
**SEP hace una sola llamada server-to-server a SISMO** y SISMO devuelve un
**código de un solo uso (one-time code)**. SEP redirige el navegador a SISMO
con ese código; SISMO lo canjea por una cookie de sesión normal (la misma
maquinaria que Google OAuth).

### 1.1 Flujo

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
     |  Set-Cookie sismo_session (HMAC, SameSite=None)    |
     |<--------------------------------------------------|  (luego SEP lo embebe)
```

### 1.2 Endpoints y contratos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/api/v1/auth/sep-login` | `Bearer <SISMO_SEP_API_TOKEN>` | SEP canjea la identidad por un one-time code. |
| `POST` | `/api/v1/auth/exchange` | — | Canjea el code por `{user_id, role, status}` (igual que Google OAuth). |
| `GET`  | `/api/v1/auth/me` | cookie de sesión | Devuelve el usuario, incluye `auth_source`. |

#### `POST /api/v1/auth/sep-login`

Header obligatorio: `Authorization: Bearer <SISMO_SEP_API_TOKEN>`
Cuerpo:
```json
{ "sep_user_id": "string", "email": "string", "name": "string | null", "role": "volunteer | admin | null" }
```
Respuesta `200`: `{ "code": "<one-time-code>" }`
Errores: `401 auth.sep_token_invalid`, `401 auth.sep_unauthorized` (token no
configurado en SISMO), `422` (faltan `sep_user_id`/`email`).

El endpoint hace **upsert** por `sep_user_id`: si existe, actualiza
`email`/`name`/`role`; si no, crea con `auth_source="sep"`, `status="active"` y
un `referral_code`. Nunca enlaza por email para mantener poblaciones separadas.

### 1.3 Variables de entorno (SISMO)

En `apps/api` (ver `.env.example`):
```
SISMO_SEP_API_TOKEN=        # secreto compartido solo SISMO<->backend SEP. Generar: openssl rand -hex 32
SISMO_OAUTH_EXCHANGE_TTL_SECONDS=300  # TTL del one-time code
```
Dejar el token vacío deshabilita el login SEP.

### 1.4 Migración BD

`apps/api/alembic/versions/010_add_user_auth_source.py`:
- `users.auth_source` (`google` | `sep`, default `google`)
- `users.sep_user_id` (único, nullable)

Aplicar con `alembic upgrade head`.

---

## 2. Modo embebido (iframe dentro de SEP)

SEP mantiene su propio header y sidebar. En una "nueva sección" carga SISMO en
un `<iframe>`; SISMO detecta el contexto y renderiza `EmbeddedShell` (sin header
ni sidebar propios, con navegación flotante).

### 2.1 Detección de contexto embebido

`getEmbedContext()` (`apps/web/lib/auth/embed.ts`) en este orden:
1. Cookie `sismo_ctx=sep` — **mecanismo principal en producción**. Se setea durante
   el login SEP (`/auth/sep`) con `SameSite=None`, así que sobrevive al iframe
   cross-site: tras la redirección del login, la cookie está presente y el shell
   embebido se renderiza solo, sin que SEP tenga que configurar nada extra.
2. `SEP_EMBED=1` (env, override local/dev).
3. Header `x-sismo-context: sep` (inyectado por el proxy de SEP).

> Nota: en desarrollo local puedes forzar el modo embebido con la cookie
> `sismo_ctx=sep` o el env `SEP_EMBED=1`. No se usa query param para esto.

El layout `apps/web/app/(app)/layout.tsx` elige `EmbeddedShell` cuando
`auth_source == "sep"` o el contexto es `sep`.

### 2.2 Snippet de iframe para SEP

```html
<!-- SEP lee su propio tema y lo pasa como ?theme= ; el modo embebido se
     resuelve solo vía la cookie sismo_ctx=sep del login SEP -->
<iframe
  src="https://app.sismo.lat/?theme=dark"
  title="Voluntarios SISMO"
  style="width:100%;height:100%;border:0;"
  allow="clipboard-write"
></iframe>
```

### 2.3 Sincronización de tema

SISMO aplica la clase `dark` en `<html>` leyendo (en orden): `?theme=`,
`localStorage.theme`, o `prefers-color-scheme`. Para que el embebido coincida
con el tema de SEP:

1. SEP guarda su tema en su propia cookie (p.ej. `sep_theme=dark`).
2. Al renderizar el iframe, SEP lee esa cookie y le pega `?theme=dark` (o
   `?theme=light`) al `src`.
3. SISMO lo aplica de inmediato y lo persiste en `localStorage`, así las
   navegaciones dentro del iframe mantienen el tema.

```ts
// Ejemplo (SEP, TypeScript): lee su cookie de tema y arma el src del iframe
function sismoIframeSrc(): string {
  const sepTheme = document.cookie
    .split("; ").find((c) => c.startsWith("sep_theme="))?.split("=")[1];
  const theme = sepTheme === "dark" || sepTheme === "light" ? sepTheme : "light";
  return `https://app.sismo.lat/?embed=1&theme=${theme}`;
}
```

### 2.4 Configuración SISMO para permitir el iframe

Para que SEP pueda embeber SISMO, SISMO debe declarar a SEP como padre permitido
vía CSP `frame-ancestors`. Se configura en `apps/web/next.config.ts` con la env
`SISMO_FRAME_ANCESTORS` (orígenes separados por coma):

```
SISMO_FRAME_ANCESTORS=https://sep.ejemplo.com,https://sep.miorganizacion.org
```

Por defecto es `self` (solo mismo origen), así que **debe** configurarse con el
origen de SEP para habilitar el embebido. No se setea `X-Frame-Options` en SISMO.

### 2.5 CORS para que SEP consuma la API

La campana de notificaciones de SEP (sección 3) llama a `api.sismo.lat`
directamente desde el browser de SEP con la cookie de sesión de SISMO
(`SameSite=None; Secure` en prod). Para que esto funcione, el origen de SEP debe
estar en la lista de CORS de la API:

```
SISMO_API_CORS_ORIGINS=https://sep.ejemplo.com,https://app.sismo.lat,...
```

`allow_credentials=True` ya está activo en `apps/api/app/main.py`, así que el
navegador enviará la cookie de sesión en el fetch cross-site.

---

## 3. Campana de notificaciones en el header de SEP

SEP puede mostrar una campana (mismo estilo/posición que `NotificationsBell` de
SISMO) que refleja las notificaciones del voluntario, llamando a la API de
SISMO con la sesión ya autenticada.

### 3.1 Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/activities/notifications/summary` | cookie sesión | `{ "unread": <int> }` — para el badge. |
| `GET` | `/api/v1/activities/notifications?limit=20&offset=0&unread_only=false` | cookie sesión | Lista de notificaciones. |
| `POST` | `/api/v1/activities/notifications/{id}/read` | cookie sesión | Marca una como leída. |

Respuesta de `list`:
```json
[
  {
    "id": "uuid",
    "type": "string",
    "title": "string",
    "message": "string",
    "activity_id": "uuid | null",
    "read": false,
    "created_at": "2026-01-01T10:00:00"
  }
]
```

### 3.2 Copy-paste (React/Next, cliente)

```tsx
"use client";
import { useEffect, useState } from "react";

const API = "https://api.sismo.lat"; // mismo origen de tu SISMO_API_URL

type Notif = {
  id: string; type: string; title: string; message: string;
  activity_id: string | null; read: boolean; created_at: string;
};

export function SismoNotificationsBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);

  // Badge: consulta el resumen cada 30s
  useEffect(() => {
    const load = () =>
      fetch(`${API}/api/v1/activities/notifications/summary`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { unread: 0 }))
        .then((d) => setUnread(d.unread ?? 0))
        .catch(() => setUnread(0));
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && items.length === 0) {
      const r = await fetch(`${API}/api/v1/activities/notifications?limit=20`, {
        credentials: "include",
      });
      if (r.ok) setItems((await r.json()) as Notif[]);
    }
  };

  const markRead = async (id: string) => {
    await fetch(`${API}/api/v1/activities/notifications/${id}/read`, {
      method: "POST",
      credentials: "include",
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={toggle} aria-label="Notificaciones de SISMO"
        style={{ position: "relative", background: "none", border: 0, cursor: "pointer", fontSize: 20 }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 18, height: 18,
            borderRadius: "50%", background: "#e11d48", color: "white",
            fontSize: 11, lineHeight: "18px", textAlign: "center", padding: "0 4px",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, marginTop: 8, width: 320, maxHeight: 360,
          overflowY: "auto", background: "white", border: "1px solid #e5e7eb",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50,
        }}>
          {items.length === 0 && (
            <div style={{ padding: 16, color: "#6b7280" }}>Sin notificaciones</div>
          )}
          {items.map((n) => (
            <div key={n.id} onClick={() => !n.read && markRead(n.id)}
              style={{
                padding: "12px 16px", borderBottom: "1px solid #f3f4f6",
                background: n.read ? "white" : "#f8fafc", cursor: n.read ? "default" : "pointer",
              }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: "#374151" }}>{n.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

> El componente oficial de SISMO está en
> `apps/web/components/notifications-bell.tsx` (estilos con Tailwind). El snippet
> de arriba es autónomo (estilos inline) para que SEP lo pegue sin depender del
> design system de SISMO. Reemplaza el emoji 🔔 por el ícono de tu design system
> para que coincida con el resto del header de SEP.

---

## 4. Reglas de negocio (ceder cupo y PII)

### 4.1 Ceder cupo (`POST /api/v1/activities/{id}/transfer`)

Implementado en `apps/api/app/api/v1/activities.py` (`transfer_membership`):
- **Usuarios externos (Google)** solo pueden ceder a **otros externos**
  (`auth_source == "google"`). Recibir de cualquiera (incluido SEP) está permitido.
- **Usuarios SEP y admins** pueden ceder a **cualquiera**.
- Cederse a sí mismo → `422`.
- El receptor debe tener la actividad en su directorio visible (externos solo
  ven a externos en `GET /users/directory`).

### 4.2 PII del creador de la actividad

En `_serialize_activity`, el creador expone públicamente: `id`, `name`,
`photo_url` y `phone`.
- El **teléfono del creador es público en la actividad misma** (se expone
  automáticamente al publicar), para que los voluntarios puedan contactarlo.
- El teléfono **no** se expone en el directorio ni en contactos manuales
  (`GET /users/directory` solo devuelve `id`, `name`, `photo_url`, `role`).

---

## 5. Para el desarrollador de SEP (resumen copy-paste)

1. **Token compartido**: solicita `SISMO_SEP_API_TOKEN` a SISMO; guárdalo como
   secreto de tu backend (nunca en el browser).
2. **Login**: al abrir Voluntarios, tu backend llama `POST /api/v1/auth/sep-login`
   y redirige al navegador a `https://app.sismo.lat/auth/sep?code=<code>`.
3. **Embed**: en una sección de SEP, carga
   `https://app.sismo.lat/?embed=1&theme=<dark|light>` en un `<iframe>`. SISMO
   muestra `EmbeddedShell` (sin header/sidebar propios).
4. **Tema**: lee la cookie de tema de SEP y pásala como `?theme=` al iframe.
5. **Campana**: pega `SismoNotificationsBell` (sección 3.2) en tu header; llama a
   `api.sismo.lat` con `credentials: "include"`.
6. **Config que SISMO debe aplicar** (pídelo a SISMO):
   - `SISMO_FRAME_ANCESTORS` incluye el origen de SEP (para `frame-ancestors`).
   - `SISMO_API_CORS_ORIGINS` incluye el origen de SEP (para CORS + credenciales).

### 5.1 Ejemplo login (Python)

```python
import os, requests
SISMO_API = os.environ["SISMO_API_URL"]          # https://api.sismo.lat
SEP_TOKEN  = os.environ["SISMO_SEP_API_TOKEN"]   # secreto compartido

def entrar_a_sismo(sep_user):
    r = requests.post(
        f"{SISMO_API}/api/v1/auth/sep-login",
        headers={"Authorization": f"Bearer {SEP_TOKEN}"},
        json={"sep_user_id": str(sep_user["id"]), "email": sep_user["email"],
              "name": sep_user.get("name")}, timeout=10,
    )
    r.raise_for_status()
    code = r.json()["code"]
    return f"https://app.sismo.lat/auth/sep?code={code}"  # 302 al navegador
```

### 5.2 Ejemplo login (Node/TS)

```ts
const SISMO_API = process.env.SISMO_API_URL!;      // https://api.sismo.lat
const SEP_TOKEN = process.env.SISMO_SEP_API_TOKEN!; // secreto compartido
export async function sismoLoginUrl(sepUser: { id: string; email: string; name?: string }) {
  const res = await fetch(`${SISMO_API}/api/v1/auth/sep-login`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SEP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sep_user_id: String(sepUser.id), email: sepUser.email, name: sepUser.name ?? null }),
  });
  if (!res.ok) throw new Error(`sep-login falló: ${res.status}`);
  const { code } = (await res.json()) as { code: string };
  return `https://app.sismo.lat/auth/sep?code=${code}`; // redirige (302)
}
```

### 5.3 A prueba de futuro

- **No acoples SEP a detalles internos de SISMO.** Solo depende del contrato
  HTTP: URL del endpoint, header `Authorization: Bearer`, body y el redirect a
  `/auth/sep?code=`. No leas/escribas cookies de SISMO.
- **`sep_user_id` estable y único** en SEP (UUID/PK). Si cambia, SISMO crea una
  cuenta nueva.
- **El code es de un uso y caduca** (~5 min). No lo caches.
- **HTTPS siempre** (la cookie de sesión lleva `Secure`).
- Si SISMO cambia de dominio, solo actualiza `SISMO_API_URL` / `SISMO_WEB_URL`.

---

## 6. Seguridad

- `SISMO_SEP_API_TOKEN` es secreto compartido: solo en backends SEP/SISMO, nunca
  en browser ni repo.
- El one-time code es de un uso y TTL corto; no es credential de sesión.
- La sesión resultante es la cookie HMAC existente (`SISMO_SESSION_SECRET`),
  `SameSite=None; Secure` en prod, idéntica a Google OAuth.
- Las restricciones (crear actividad, ceder cupo, directory) se aplican en el
  backend, no solo en UI.
- El embebido está limitado por CSP `frame-ancestors` a los orígenes SEP
  configurados; CORS de la API limita los orígenes que pueden leer notificaciones.

---

## 7. Evolución (no inmediata)

Esta integración de corto plazo es funcional pero acopla a SEP al iframe y a la
API HTTP de SISMO en el browser (cookies cross-site + CORS). El plan de
**medio/largo plazo, óptimo y desacoplado** (API server-to-server de socio,
webhooks, SSO OIDC, micro-frontend/web components) está en
[`docs/SEP_INTEGRATION_LONGTERM.md`](./SEP_INTEGRATION_LONGTERM.md) y se construye
**después** de que este MVP esté operando.
