# Integración SISMO ⇄ SEP — Micro-frontend (Module Federation)

> **Mecanismo elegido:** SISMO se expone como **módulo remoto** (Module
> Federation) y SEP lo **importa y monta dentro de su propia shell** (su header y
> su sidebar). SEP crea, p.ej., una pestaña `sismo-voluntariados` cuyo área de
> contenido renderiza el código de SISMO. SISMO mantiene su propia API, su
> propia BD y su propia lógica; SEP solo "trae" su UI y le pasa la identidad del
> usuario ya autenticado.
>
> **Decisión:** se descartó el enfoque de "subpágina tras proxy reverso" (iframe
> cross-site) porque el mismo-origen elimina problemas de cookies/CORS, y se
> eligió micro-frontend sobre el proxy reverso porque SEP mantiene su propio
> chrome (header+sidebar) y la integración es más limpia. La variante de proxy
> reverso queda documentada como alternativa en `docs/SEP_INTEGRATION_COOKBOOK.md`.

---

## Estado de la integración

**Hecho en el lado SISMO (listo para integrar):**

- Flujo de identidad/sesión de usuarios SEP: `POST /api/v1/auth/sep-login`
  (server-to-server, `Bearer <SISMO_SEP_API_TOKEN>` → one-time `code`) y
  `POST /api/v1/auth/exchange` ya existen; el remote redime el `code` y obtiene
  la cookie `sismo_session` sin re-login.
- `EmbeddedShell` (`apps/web/components/embedded-shell.tsx`) ya no dibuja
  header/sidebar propios, precisamente para que **SEP muestre su propio
  chrome** y SISMO no lo duplique.
- Infra cableada: `SISMO_SEP_API_TOKEN`, `SISMO_FRAME_ANCESTORS`,
  `SISMO_API_CORS_ORIGINS` en `infra/docker-compose.yml` + `.env`.
- Regla de negocio: los tags de zona y el feed de descubrimiento excluyen las
  actividades que el usuario ya creó **y** las en las que ya está inscrito.
- **Partner API** (`apps/api/app/api/v1/partner.py`): implementada. SEP la
  consulta server-to-server (`Bearer <SISMO_SEP_API_TOKEN>`) para mostrar las
  notificaciones de SISMO en su header. Contrato en el cookbook.

**Pendiente en el lado SISMO:**

- **Empaquetar el web como remote MF** (`next.config.ts` + `sismo-app.tsx` +
  `sep-user.tsx`): *receta no aplicada y bloqueada por diseño de tooling* — el
  App Router de Next 15 no es soportado por `@module-federation/nextjs-mf` y el
  plugin plano no resuelve `react-dom/client` (ver "Por qué el remote MF aún es
  receta" arriba). Vía pragmática recomendada: **proxy reverso / app única**
  (SISMO sigue siendo su propio Next App Router servido en ruta de SEP).

**Depende de SEP (decisiones suyas):**

- Framework/host de SEP y runtime de Module Federation compatible (mismo React
  major que SISMO: Next 15.5 → React 19).
- Origen/dominio final (define `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_ORIGIN` y
  dónde SEP sirve el static del remote).
- Limpiar la cookie `sismo_session` en su logout global.

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

- SISMO **web** se construye para exponer un remote Module Federation. SEP (host)
  lo consume y lo monta en su contenido.
- SISMO **api/postgres/redis** corren como contenedores en el server de SEP. La
  API se sirve en el mismo origen de SEP (p.ej. `sep.org/voluntarios/api`) para
  que la cookie de sesión de SISMO sea first-party y no haya CORS.
- SISMO usa **su propia BD** (BD separada en la instancia postgres de SEP).

---

## 2. Identidad y autenticación

### 2.1 Usuarios internos de SEP (sin re-login)

1. El backend de SEP llama `POST /api/v1/auth/sep-login` de SISMO
   (server-to-server, `Authorization: Bearer <SISMO_SEP_API_TOKEN>`) y obtiene un
   **one-time code**.
2. SEP pasa ese `code` al remote de SISMO como prop/contexto cuando lo monta.
3. El remote redime el `code` (`POST /api/v1/auth/exchange`) y obtiene la cookie
   de sesión de SISMO (`sismo_session`). A partir de ahí el remote se comporta
   como la app normal de SISMO.
4. **Logout:** es el logout de SEP; SEP además limpia `sismo_session`.

> Reusa el flujo `sep-login`/`exchange` ya existente. No se necesita el header
> HMAC del proxy (esa era la variante de proxy reverso, ver cookbook).

### 2.2 Usuarios externos (login propio de SISMO)

Si SEP monta el remote para un visitante sin sesión SEP, el remote muestra el
login de SISMO (Google OAuth). SEP simplemente no pasa `code`.

---

## 3. Web de SISMO: exponerse como remote MF

### Por qué el remote MF aún es receta (no aplicada) — bloqueo definitivo

Se probó empíricamente (spike, jul-2026) empaquetar el web de SISMO como remote
MF y **no es viable con el App Router actual**:

- `@module-federation/nextjs-mf` (incluido el build de compatibilidad `next`,
  `0.0.0-codex-node24-...`) **falla explícitamente**:
  `App Directory is not supported by nextjs-mf. Use only pages directory`.
  El plugin Next-específico solo soporta el **Pages Router**.
- `@module-federation/enhanced` v2.7.0 (el `ModuleFederationPlugin` de webpack
  directo, sin el plugin Next) compila el entry federado pero **no resuelve
  `react-dom/client`** de Next (`Module not found: Can't resolve
  'react-dom/client'`), porque MF consume `react-dom` como módulo compartido sin
  proveedor en build-time. Tampoco sirve para App Router.

**Conclusión:** el modelo "SEP monta `./SismoApp` desde el Next de SISMO" no se
puede lograr con el tooling MF actual mientras SISMO use App Router. Para MF
real haría falta (a) migrar SISMO a **Pages Router** (rewrite grande, no
planificado), o (b) re-arquitectar la UI de SISMO como **SPA cliente** (Vite/Rspack)
expuesta como remote — también re-architecture. Por eso la vía pragmática es la
**alternativa de proxy reverso / app única** del cookbook (SEP sirve el Next de
SISMO en una ruta de su dominio), que sí es compatible con App Router. La
receta de abajo queda como referencia de lo que se intentó.

### Receta `apps/web/next.config.ts`

```ts
import type { NextConfig } from "next";
import { NextFederationPlugin } from "@module-federation/nextjs-mf";

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config) => {
    config.plugins.push(
      new NextFederationPlugin({
        name: "sismo",
        filename: "static/sismoRemoteEntry.js",
        exposes: { "./SismoApp": "./app/(app)/sismo-app.tsx" },
        shared: {
          react: { singleton: true, requiredVersion: false },
          "react-dom": { singleton: true, requiredVersion: false },
        },
      })
    );
    return config;
  },
};
export default nextConfig;
```

### Receta `app/(app)/sismo-app.tsx`

Componente que recibe `sepCode` y monta `EmbeddedShell` (sin chrome propio).
Un `SEPUserProvider` redime el `code` vía `fetch("/auth/sep?code=…")` (mismo
origen, aplica las cookies de sesión). Ver cookbook §B.5b.

### Variables del web (`.env` en server SEP)

```
NEXT_PUBLIC_API_URL=https://sep.org/voluntarios/api   # mismo origen
NEXT_PUBLIC_WEB_ORIGIN=https://sep.org
# SEP_EMBED ya no es estrictamente necesario en MFE, pero se deja para
# forzar EmbeddedShell en dev: SEP_EMBED=1
```

---

## 4. SEP (host): montar el remote de SISMO

Pseudocódigo (el detalle depende del host de SEP):

```text
# 1. SEP declara el remote "sismo" apuntando al static del remote de SISMO:
#    remotes: { sismo: "sismo@https://sep.org/voluntarios/_next/static/sismoRemoteEntry.js" }

# 2. Ruta/pestaña de SEP "sismo-voluntariados":
#    - SEP valida sesión de SEP.
#    - Si hay usuario SEP: SEP backend llama POST /api/v1/auth/sep-login
#      (Bearer SISMO_SEP_API_TOKEN) -> { code }
#    - SEP renderiza su shell (header+sidebar) y monta: <SismoApp sepCode={code} />
#    - Si NO hay sesión SEP: <SismoApp />  (SISMO muestra su login Google)

# 3. Logout de SEP: limpiar sismo_session (cookie same-origin) además de la sesión SEP.
```

El header de SEP (campana de notificaciones) se alimenta vía API
server-to-server (ver §6).

---

## 5. Datos

- SISMO lleva su **propia base de datos** (postgres), BD separada en la instancia
  de postgres de SEP (`SISMO_DB_NAME=sismo_sep`) para no acoplar esquemas.
- Al redimir el `code`, SISMO hace upsert de `User` con `auth_source="sep"` y
  `sep_user_id` (reusa `_resolve_or_create_sep_user`). SISMO guarda en su propia
  tabla los campos extra que SEP no maneja. La identidad canónica viene del
  backend de SEP.
- Usuarios externos: `auth_source="google"`, lógica separada existente.

---

## 6. Notificaciones en el header de SEP (server-to-server)

SEP muestra las notificaciones de SISMO en su header general. SISMO expone la
**Partner API** (`apps/api/app/api/v1/partner.py`), autenticada con
`SISMO_SEP_API_TOKEN` (Bearer), que el backend de SEP consulta por el
`sep_user_id`. Contrato completo en el cookbook (sección Partner API).

```
GET /partner/v1/users/{sep_user_id}/notifications/summary
   Authorization: Bearer <SISMO_SEP_API_TOKEN>
GET /partner/v1/users/{sep_user_id}/notifications
   Authorization: Bearer <SISMO_SEP_API_TOKEN>
```

---

## 7. Qué envía y recibe el servidor de SEP

**SEP envía a SISMO:** un `code` one-time (vía `POST /api/v1/auth/sep-login`,
server-to-server) al montar el remote para un usuario SEP; el remote lo redime.

**SEP recibe de SISMO (server-to-server):** resumen/lista de notificaciones del
usuario SEP (`/partner/v1/...`) para el header de SEP.

**SEP debe además:** servir el static del remote de SISMO y enrutar
`/voluntarios/api` → api de SISMO (mismo origen); limpiar `sismo_session` en su
logout global.

---

## 8. Variables de entorno y placeholders

| Variable | Dónde | Valor / estado |
|---|---|---|
| `SISMO_SESSION_SECRET` | api+web | firma de cookie (existente) |
| `SISMO_SEP_API_TOKEN` | api | Bearer de `sep-login` + Partner API (existente; placeholder en `.env.example`) |
| `SISMO_SEP_PROXY_SECRET` | api | **solo variante proxy reverso** (ver cookbook); no se usa en MFE |
| `NEXT_PUBLIC_API_URL` | web | `https://sep.org/voluntarios/api` (a fijar en origen SEP) |
| `NEXT_PUBLIC_WEB_ORIGIN` | web | `https://sep.org` (a fijar en origen SEP) |
| `SISMO_FRAME_ANCESTORS` | infra/docker-compose.yml + `.env` | placeholder (existe) |
| `SISMO_DB_*` | api | instancia postgres de SEP (BD separada) |

---

## 9. Pasos de despliegue (resumen)

1. **SISMO api — hecho:** Partner API implementada (`partner.py`); verificar que
   `SISMO_SEP_API_TOKEN` esté configurado en el deploy.
2. **SISMO web — bloqueado como MF:** empaquetar como remote MF no es viable con
   App Router (ver §3). Vía recomendada: **proxy reverso / app única** — SISMO se
   sirve como su propio Next en una ruta de SEP (p. ej. `sep.org/voluntarios/`),
   sin cambiar el App Router. Ver cookbook (variante proxy reverso).
3. **SISMO api — hecho:** `sep-login`, `exchange`, `/auth/sep` y `EmbeddedShell`
   ya están; verificar que `SISMO_SEP_API_TOKEN` esté configurado.
4. **SEP:** declarar el remote `sismo`, montarlo en su shell (header+sidebar),
   pasar `sepCode` obtenido server-to-server; backend que consulta la Partner API
   y pinta la campana.
5. **Verificar:** usuario SEP entra a la pestaña → sin login → ve sus
   actividades; usuario externo → login Google; logout SEP limpia sesión.

> Los bloques de código exactos (MF web, SEP host, variante proxy reverso,
> contrato HMAC y Partner API) están en `docs/SEP_INTEGRATION_COOKBOOK.md`.
