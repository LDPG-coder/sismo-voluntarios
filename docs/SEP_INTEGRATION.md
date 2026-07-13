# Integración SISMO ⇄ SEP — Micro-frontend (Module Federation)

> **Mecanismo elegido:** SISMO se expone como **módulo remoto** (Module
> Federation) y SEP lo **importa y monta dentro de su propia shell** (su header y
> su sidebar). SEP crea, p.ej., una pestaña `sismo-voluntariados` cuyo área de
> contenido renderiza el código de SISMO. SISMO sigue teniendo su propia API, su
> propia BD y su propia lógica; SEP solo "trae" su UI y le pasa la identidad del
> usuario ya autenticado.
>
> Esto reemplaza el enfoque de "subpágina tras proxy reverso" (documentado como
> alternativa en `docs/SEP_INTEGRATION_COOKBOOK.md`). El micro-frontend da la
> integración más limpia con el chrome de SEP, a cambio de acoplar los builds de
> SEP y SISMO.

---

## 1. Topología de despliegue

```
  SEP (host, su propio SPA/SSR)
  ┌──────────────────────────────────────────────────────────┐
  │ Header de SEP │ Sidebar de SEP                             │
  │ ┌────────────────────────────────────────────────────┐   │
  │ │ Contenido de la pestaña "sismo-voluntariados":       │   │
  │ │   <SismoApp />  (remote MF de SISMO, montado aquí)   │   │
  │ └────────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────────┘
            │ SISMO remote JS se carga desde el contenedor SISMO
            │ SISMO remote hace fetch a la API de SISMO (mismo origen)
  SISMO (contenedores en server SEP):
     web (Next.js, expone remote MF) · api (FastAPI) · postgres · redis
```

- SISMO **web** se construye para exponer un remote Module Federation (sus
  rutas/componentes). SEP (host) lo consume y lo monta en su contenido.
- SISMO **api/postgres/redis** corren como contenedores en el server de SEP. La
  API se sirve en el mismo origen de SEP (p.ej. `sep.org/voluntarios/api`) para
  que la cookie de sesión de SISMO sea first-party y no haya CORS.
- SISMO usa **su propia BD** (BD separada en la instancia postgres de SEP).

---

## 2. Identidad y autenticación

### 2.1 Usuarios internos de SEP (sin re-login)

SEP ya autenticó al usuario. El flujo:

1. El backend de SEP, para un usuario SEP, llama a
   `POST /api/v1/auth/sep-login` de SISMO (server-to-server, con
   `Authorization: Bearer <SISMO_SEP_API_TOKEN>`) y obtiene un **one-time code**.
2. SEP pasa ese `code` al remote de SISMO como prop/contexto cuando lo monta.
3. El remote de SISMO redime el `code` (`POST /api/v1/auth/exchange`) y obtiene
   la cookie de sesión de SISMO (`sismo_session`). A partir de ahí el remote se
   comporta como la app normal de SISMO (lee `/auth/me`, etc.).
4. **Logout:** es el logout de SEP; SEP además limpia `sismo_session`.

> Esto reusa el flujo `sep-login`/`exchange` que ya existe en SISMO. No se
> necesita el header HMAC del proxy (ese era para la variante de proxy reverso).

### 2.2 Usuarios externos (login propio de SISMO)

Si SEP monta el remote para un visitante sin sesión SEP, el remote muestra el
login de SISMO (Google OAuth) como hoy. SEP simplemente no pasa `code` y deja
que SISMO maneje su propio login.

---

## 3. Web de SISMO: exponerse como remote MF

### 3.1 `apps/web/next.config.ts` — exponer el remote

SISMO debe compilarse como productor de un remote Module Federation. La
configuración exacta depende del plugin compatible con la versión de Next
(Next 15 + `@module-federation/enhanced`). Ejemplo de receta:

```ts
import type { NextConfig } from "next";
import { NextFederationPlugin } from "@module-federation/nextjs-mf";

const nextConfig: NextConfig = {
  output: "standalone",
  // Sin basePath: en MFE quien define la ruta es el host (SEP).
  webpack: (config, { isServer }) => {
    config.plugins.push(
      new NextFederationPlugin({
        name: "sismo",
        filename: "static/sismoRemoteEntry.js",
        exposes: {
          "./SismoApp": "./app/(app)/sismo-app.tsx", // root del remote
        },
        shared: {
          react: { singleton: true, requiredVersion: false },
          "react-dom": { singleton: true, requiredVersion: false },
        },
        extraOptions: { exposePages: false },
      })
    );
    return config;
  },
};
export default nextConfig;
```

> **Pendiente de confirmar con SEP:** el plugin y la versión de Next exactos, y
> que SEP use un runtime de Module Federation compatible (mismo React major).

### 3.2 Root del remote — `app/(app)/sismo-app.tsx`

El remote debe exportar un componente que reciba el contexto de SEP (el `code`
de sesión y, opcionalmente, datos del usuario) y renderice `EmbeddedShell`
(sin header/sidebar propios, porque SEP ya los provee):

```tsx
"use client";
import { EmbeddedShell } from "@/components/embedded-shell";
import { SEPUserProvider } from "@/lib/auth/sep-user"; // pasa `code` al client

export default function SismoApp({
  sepCode,
}: {
  sepCode?: string;
}) {
  return (
    <SEPUserProvider sepCode={sepCode}>
      <EmbeddedShell>{/* rutas internas de SISMO */}</EmbeddedShell>
    </SEPUserProvider>
  );
}
```

`EmbeddedShell` (`apps/web/components/embedded-shell.tsx`) **no** dibuja
header ni sidebar propios: solo el contenido + nav flotante, para no duplicar el
chrome de SEP.

### 3.3 Variables del web (`.env` en server SEP)

```
NEXT_PUBLIC_API_URL=https://sep.org/voluntarios/api   # mismo origen
NEXT_PUBLIC_WEB_ORIGIN=https://sep.org
# SEP_EMBED ya no es estrictamente necesario en MFE, pero se deja para
# forzar EmbeddedShell en dev: SEP_EMBED=1
```

---

## 4. SEP (host): montar el remote de SISMO

SEP consume el remote y lo monta en su área de contenido. Pseudocódigo
(framework-agnóstico; el detalle depende del host de SEP):

```text
# 1. SEP declara el remote "sismo" apuntando al static del remote de SISMO:
#    remotes: { sismo: "sismo@https://sep.org/voluntarios/_next/static/sismoRemoteEntry.js" }

# 2. Ruta de SEP "/voluntarios" (o pestaña "sismo-voluntariados"):
#    - SEP valida sesión de SEP.
#    - Si hay usuario SEP: SEP backend llama POST /api/v1/auth/sep-login
#      (Bearer SISMO_SEP_API_TOKEN) -> { code }
#    - SEP renderiza su shell (header+sidebar) y monta:
#        <SismoApp sepCode={code} />
#    - Si no hay sesión SEP: <SismoApp /> (SISMO muestra su login).

# 3. Logout de SEP: limpiar sismo_session (cookie same-origin) además de la
#    sesión de SEP.
```

El header de SEP (campana de notificaciones) se alimenta vía API
server-to-server, igual que en la variante de proxy (ver §6).

---

## 5. Datos

- SISMO lleva su **propia base de datos** (postgres). Se recomienda una BD
  separada dentro de la instancia de postgres de SEP (`SISMO_DB_NAME=sismo_sep`)
  para no acoplar esquemas.
- Al redimir el `code`, SISMO hace upsert de `User` con `auth_source="sep"` y
  `sep_user_id` (reusa `_resolve_or_create_sep_user`). SISMO guarda en su propia
  tabla los campos extra que SEP no maneja. La identidad canónica viene del
  backend de SEP.
- Usuarios externos: `auth_source="google"`, lógica separada existente.

---

## 6. Notificaciones en el header de SEP (server-to-server)

SEP muestra las notificaciones de SISMO en su header general. SISMO expone la
**Partner API** autenticada con `SISMO_SEP_API_TOKEN` (Bearer), que el backend
de SEP consulta por el `sep_user_id` del usuario actual. Contrato completo en
`docs/SEP_INTEGRATION_COOKBOOK.md` (sección Partner API):

```
GET /partner/v1/users/{sep_user_id}/notifications/summary
   Authorization: Bearer <SISMO_SEP_API_TOKEN>
GET /partner/v1/users/{sep_user_id}/notifications
   Authorization: Bearer <SISMO_SEP_API_TOKEN>
```

---

## 7. Qué envía y recibe el servidor de SEP

**SEP envía a SISMO:**
- Al montar el remote para un usuario SEP: un `code` one-time obtenido vía
  `POST /api/v1/auth/sep-login` (server-to-server). El remote lo redime.
- (Opcional) datos del usuario para evitar un fetch extra.

**SEP recibe de SISMO (server-to-server):**
- Resumen/lista de notificaciones del usuario SEP (`/partner/v1/...`) para el
  header de SEP.

**SEP debe además:**
- Servir el static del remote de SISMO y enrutar `/voluntarios/api` → api de
  SISMO (mismo origen).
- Limpiar `sismo_session` en su logout global.

---

## 8. Variables de entorno (SISMO en server SEP)

| Variable | Dónde | Valor |
|---|---|---|
| `SISMO_SESSION_SECRET` | api+web | firma de cookie (existente) |
| `SISMO_SEP_API_TOKEN` | api | Bearer de `sep-login` + Partner API (existente) |
| `NEXT_PUBLIC_API_URL` | web | `https://sep.org/voluntarios/api` |
| `NEXT_PUBLIC_WEB_ORIGIN` | web | `https://sep.org` |
| `SISMO_DB_*` | api | instancia postgres de SEP (BD separada) |

---

## 9. Pasos de despliegue (resumen)

1. SISMO web: configurar MF plugin, exponer `./SismoApp`, crear
   `sismo-app.tsx` que recibe `sepCode` y monta `EmbeddedShell`.
2. SISMO api: asegurar `POST /api/v1/auth/sep-login` + `/exchange` y Partner API.
3. SEP: declarar el remote `sismo`, montarlo en su shell (header+sidebar),
   pasar `sepCode` obtenido server-to-server.
4. SEP: backend que consulta la Partner API y pinta la campana en su header.
5. Verificar: usuario SEP entra a la pestaña → sin login → ve sus actividades;
   usuario externo → login Google; logout SEP limpia sesión.

---

## 10. Preguntas abiertas / pendientes de SEP

1. **Framework/host de SEP y runtime de Module Federation.** Define el plugin
   MF del lado SISMO (versión de Next/React) y cómo SEP consume el remote.
   Mientras tanto, la receta §3.1 es propuesta, no final.
2. **Origen/dominio final de SEP.** Define `NEXT_PUBLIC_API_URL`,
   `NEXT_PUBLIC_WEB_ORIGIN` y dónde SEP sirve el static del remote.
3. **Coordinación de builds.** SEP debe construir/señalar al artefacto MF de
   SISMO; conviene un pipeline que publique el remote y SEP lo consuma por URL.
4. **Smoke test end-to-end.** El usuario indicó que aún no puede tocar SEP, así
   que la verificación real queda pendiente.

## 11. Dónde van los placeholders en el código

| Valor / archivo | Ruta | Estado |
|---|---|---|
| `SISMO_SEP_API_TOKEN` | `.env.example` (§SEP), `infra/docker-compose.yml` (api) | placeholder (existe) |
| `SISMO_FRAME_ANCESTORS` | `infra/docker-compose.yml` (~77) + `.env` | placeholder (existe) |
| `NEXT_PUBLIC_API_URL` | `.env` / `infra/docker-compose.yml` (web) | a fijar en origen SEP |
| `NEXT_PUBLIC_WEB_ORIGIN` | `.env` | a fijar en origen SEP |
| `SEP_EMBED=1` | `.env` del web | opcional en MFE |
| `SISMO_DB_*` | `.env` | BD separada en pg de SEP |
| Exponer remote MF | `apps/web/next.config.ts` (§3.1) | **código/receta** |
| Root del remote | `apps/web/app/(app)/sismo-app.tsx` (§3.2) | **nuevo** |
| `sep-login` + `/exchange` + Partner API | `apps/api/app/api/v1/auth.py`, `partner.py` | existen / §cookbook |
| Montar remote en SEP | app host de SEP | **pseudocódigo** §4 |

> Los bloques de código exactos (incluida la variante de proxy reverso y el
> contrato HMAC/Partner API) están en `docs/SEP_INTEGRATION_COOKBOOK.md`.
