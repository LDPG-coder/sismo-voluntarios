# Integración SISMO ⇄ SEP — Proxy reverso (SISMO en subruta de SEP)

> **Dominio de ejemplo:** en este documento se usa `sep.org` como ejemplo de la
> página del SEP (p. ej. `https://sep.org/voluntarios/`). Sustituir por el
> dominio real de SEP en cada caso.

> ## Decisión (jul-2026)
>
> **Mecanismo adoptado: proxy reverso.** SISMO se sirve como su propia
> aplicación Next dentro de una ruta de la página del SEP (por ejemplo
> `https://sep.org/voluntarios/`). SEP agrega un enlace en su menú y configura
> un reverse proxy que dirige el tráfico de esa ruta hacia los contenedores de
> SISMO. SISMO mantiene su API, su BD y su lógica; SEP no compila ni embebe el
> código de SISMO. El proxy reverso es compatible con el App Router de Next 15
> y exige poco trabajo del lado de SEP.
>
> **Identidad:** SEP, por medio de su proxy, envía a SISMO la identidad del
> usuario ya autenticado firmada por HMAC. SISMO la verifica y emite su propia
> cookie de sesión, de modo que el usuario de SEP entra a SISMO sin volver a
> autenticarse.
>
> **Notificaciones en el header de SEP:** SISMO expone la *Partner API*
> (server-to-server) que el backend de SEP consulta para pintar la campana.

---

## Estado de la integración

**Funcional en SISMO (implementado):**

- **Partner API** (`apps/api/app/api/v1/partner.py`): implementada y con tests.
  SEP la consulta con `Bearer <SISMO_SEP_API_TOKEN>` para mostrar las
  notificaciones de SISMO en su header.
- **Flujo de identidad SEP (alternativa por código):** `POST /api/v1/auth/sep-login`
  (server-to-server, `Bearer <SISMO_SEP_API_TOKEN>` → one-time `code`) y
  `POST /api/v1/auth/exchange` ya existen. Se usa si SEP prefiere generar un
  `code` en lugar de firmar headers.
- **Infra cableada:** `SISMO_SEP_API_TOKEN`, `SISMO_SEP_PROXY_SECRET`,
  `SISMO_FRAME_ANCESTORS`, `SISMO_API_CORS_ORIGINS` en
  `infra/docker-compose.yml` + `.env`.
- **Regla de negocio:** los tags de zona y el feed de descubrimiento excluyen
  las actividades que el usuario ya creó y las en las que ya está inscrito.
- SISMO usa **su propia BD** (postgres, BD separada `sismo_sep`).

**Pendiente (no aplicado en el repositorio):**

- Verificación del header firmado de SEP (HMAC) en la API.
- Configuración del web para la subruta `/voluntarios` (`basePath`) y
  `NEXT_PUBLIC_API_URL` al mismo origen.
- Despliegue de SISMO detrás del reverse proxy de SEP.
- Configuración de SEP (proxy, inyección de identidad, enlace en sidebar,
  campana, limpieza de cookie en logout).

---

## 1. Topología de despliegue

```
  SEP (sitio en sep.org)
  ┌──────────────────────────────────────────────────────────┐
  │ Header/sidebar de SEP  ·  enlace "Voluntariados"          │
  │                                                            │
  │  Al acceder a /voluntarios  ──┐                            │
  └───────────────────────────────┼────────────────────────────┘
                                   │ (reverse proxy de SEP)
                                   ▼
  SISMO (contenedores en el mismo server/dominio de SEP)
  ┌──────────────────────────────────────────────────────────┐
  │  web (Next.js) en  /voluntarios      api (FastAPI) en      │
  │                              /voluntarios/api             │
  │  · renderiza la página completa de SISMO (su propio        │
  │    header/navegación, o uno que imita al de SEP)           │
  │  · postgres (BD propia sismo_sep) · redis                  │
  └──────────────────────────────────────────────────────────┘
```

- SISMO **web** se sirve íntegro en `/voluntarios` (no como un fragmento
  embebido, sino como una página más del sitio de SEP, bajo el mismo dominio).
- SISMO **api/postgres/redis** corren como contenedores en el server de SEP. La
  API se sirve en el mismo origen (`sep.org/voluntarios/api`) para que la cookie
  de sesión de SISMO sea *first-party* y no haya problemas de CORS ni de
  cookies de terceros.
- SISMO usa **su propia BD** (separada dentro de la instancia postgres de SEP).

---

## 2. Identidad y autenticación

### 2.1 Usuarios de SEP (acceso sin re-login)

1. El usuario inicia sesión en SEP.
2. Cuando SEP sirve cualquier request a `/voluntarios*`, su proxy inyecta un
   "pase" firmado con la identidad del usuario (`x-sismo-sep-user` +
   `x-sismo-sep-sig`, ver §A del cookbook). Solo se inyecta si el usuario tiene
   sesión SEP.
3. La API de SISMO recibe ese header, verifica la firma HMAC con
   `SISMO_SEP_PROXY_SECRET` (secreto compartido solo entre SEP y SISMO). Si es
   válido, crea o actualiza el usuario SEP en su BD y devuelve al navegador la
   cookie de sesión de SISMO (`sismo_session`).
4. A partir de ahí, el navegador ya porta la cookie y SISMO lo trata como
   usuario autenticado. El usuario de SEP no ve ningún login de SISMO.

> *Alternativa:* en lugar de firmar headers, SEP puede generar un `code` una vez
> vía `POST /api/v1/auth/sep-login` y SISMO lo redime con
> `POST /api/v1/auth/exchange`. El flujo por header HMAC es el más simple para
> proxy reverso.

### 2.2 Usuarios externos (login propio de SISMO)

Para las rutas de login de SISMO (`/voluntarios/login*`,
`/voluntarios/api/v1/auth/*`) el proxy de SEP no inyecta la identidad. Así, un
visitante sin sesión SEP ve el login de Google de SISMO y se autentica por su
cuenta.

### 2.3 Logout

En el logout de SEP se debe borrar también la cookie `sismo_session` (mismo
origen `sep.org`), de forma que al salir de SEP también se cierre la sesión de
SISMO.

---

## 3. Responsabilidades paso a paso

Esta sección describe, en orden, las tareas de cada lado y qué implica cada
paso. El objetivo es que tanto SISMO como SEP conozcan exactamente qué deben
hacer. El tono es descriptivo; los bloques de código exactos están en
`docs/SEP_INTEGRATION_COOKBOOK.md`.

### 3.1 SISMO

**Paso 1 — Hacer que SISMO resida en la subruta `/voluntarios`.**
En `apps/web/next.config.ts` se agrega `basePath: "/voluntarios"`. Esto indica
a Next que todas sus páginas, archivos y enlaces internos se prefijan con
`/voluntarios`. Esto es necesario para que el proxy de SEP distinga qué
peticiones son de SISMO (`/voluntarios/...`) y cuáles del resto de SEP; el
`basePath` lo resuelve sin modificar cada enlace. (Receta B.5 del cookbook.)

**Paso 2 — Apuntar el web a la API en el mismo dominio.**
En el `.env` del web en el server de SEP se define
`NEXT_PUBLIC_API_URL=https://sep.org/voluntarios/api` y
`NEXT_PUBLIC_WEB_ORIGIN=https://sep.org`. El navegador del usuario llama a la API
desde el mismo dominio `sep.org`, con lo que la cookie de sesión es
*first-party* (no se bloquea por políticas de cookies de terceros) y no hay
problemas de CORS.

**Paso 3 — Verificar la identidad que SEP envía (HMAC).**
Se implementa en la API la verificación de los headers firmados
`x-sismo-sep-user` / `x-sismo-sep-sig` (receta B.1–B.3 del cookbook) usando
`SISMO_SEP_PROXY_SECRET`. Este es el mecanismo que autentica al usuario de SEP
en SISMO sin que teclee credenciales. Si la firma no coincide, SISMO ignora el
header y trata al visitante como no autenticado (flujo normal de login). Sin
este paso, SEP no puede transmitir la identidad de forma segura.

**Paso 4 — Desplegar en el server de SEP.**
Los contenedores de SISMO (web, api, postgres con BD `sismo_sep`, redis) se
despliegan en el server de SEP, detrás del proxy que SEP configura. SISMO queda
así como una sección más del sitio de SEP, bajo su dominio.

**Paso 5 — Dejar la Partner API operativa.**
Ya está implementada; solo se verifica que `SISMO_SEP_API_TOKEN` esté
configurado en el despliegue. Es lo que SEP usa para mostrar la campana de
notificaciones de SISMO en su header general (ver §4).

**Paso 6 — (Opcional, solo estético) Igualar la apariencia con SEP.**
En el proxy reverso full-page, SISMO muestra su propia página completa (su
header/navegación propios, igual que hoy en el sitio de SISMO). Si se desea que
se vea idéntico al sitio de SEP, se replica el header/sidebar de SEP dentro de
la UI de SISMO; para eso SEP proporciona el markup/CSS de su header y sidebar.
No es obligatorio para que funcione, pero mejora la continuidad visual. Si no
se hace, SISMO se ve como "su propio sitio" dentro de la ruta de SEP, lo cual
también es válido.

### 3.2 SEP

**Paso 1 — Configurar el reverse proxy.**
Se hace que todo lo que llegue a `/voluntarios` y `/voluntarios/api` se
reenvíe a los contenedores de SISMO. Esto equivale a "esta parte del sitio la
atiende la app de SISMO" y es la única pieza de infra que SEP debe montar para
el tráfico de SISMO. (Rutas sugeridas en §C.2 del cookbook.)

**Paso 2 — Inyectar la identidad firmada.**
En su proxy, solo si el usuario tiene sesión SEP, se arman e inyectan los
headers `x-sismo-sep-user` y `x-sismo-sep-sig` (firmados con
`SISMO_SEP_PROXY_SECRET`, compartido con SISMO) en cada request a
`/voluntarios*`. Así SISMO sabe quién es el usuario y lo autentica sin pedirle
credenciales. Es el equivalente a "SEP le pasa el pase a SISMO". (Receta C.1
del cookbook.)

**Paso 3 — No inyectar la identidad en los logins de SISMO.**
En `/voluntarios/login*` y `/voluntarios/api/v1/auth/*` no se inyecta el
header, para que los usuarios externos puedan autenticarse con Google en SISMO.
Si siempre se inyectara identidad, un usuario externo nunca podría usar el login
propio de SISMO.

**Paso 4 — Agregar la opción en su sidebar.**
Se añade un enlace "Voluntariados" que apunte a `https://sep.org/voluntarios/`.
Desde el punto de vista de SEP, esto es solo un ítem de menú más, como
cualquier otra sección. No se embebe código de SISMO; solo se enlaza.

**Paso 5 — Pintar la campana de notificaciones de SISMO.**
Su backend, para el usuario actual, consulta la Partner API de SISMO
(`GET /partner/v1/users/{sep_user_id}/notifications/summary` con
`SISMO_SEP_API_TOKEN`) y muestra el contador en el header que SEP ya usa en todo
el sitio. (Receta C.3 del cookbook.)

**Paso 6 — Limpiar la sesión de SISMO al salir.**
En su logout global, además de cerrar la sesión de SEP, se borra la cookie
`sismo_session`. Si no se hace, el usuario podría seguir autenticado en SISMO
aunque haya salido de SEP.

---

## 4. Notificaciones en el header de SEP (server-to-server)

SISMO expone la **Partner API** (`apps/api/app/api/v1/partner.py`),
autenticada con `SISMO_SEP_API_TOKEN` (Bearer), que el backend de SEP consulta
por el `sep_user_id`. Contrato completo en el cookbook (sección D).

```
GET /partner/v1/users/{sep_user_id}/notifications/summary
   Authorization: Bearer <SISMO_SEP_API_TOKEN>
GET /partner/v1/users/{sep_user_id}/notifications
   Authorization: Bearer <SISMO_SEP_API_TOKEN>
```

---

## 5. Datos

- SISMO lleva su **propia base de datos** (postgres), BD separada en la instancia
  de postgres de SEP (`SISMO_DB_NAME=sismo_sep`) para no acoplar esquemas.
- Al verificar el header firmado, SISMO hace upsert de `User` con
  `auth_source="sep"` y `sep_user_id` (reusa `_resolve_or_create_sep_user`).
  SISMO guarda en su propia tabla los campos extra que SEP no maneja; la
  identidad canónica viene del backend de SEP.
- Usuarios externos: `auth_source="google"`, lógica separada existente.

---

## 6. Variables de entorno y placeholders

| Variable | Dónde | Valor / estado |
|---|---|---|
| `SISMO_SESSION_SECRET` | api+web | firma de cookie (existente) |
| `SISMO_SEP_API_TOKEN` | api | Bearer de `sep-login` + Partner API (existente; placeholder en `.env.example`) |
| `SISMO_SEP_PROXY_SECRET` | api | usado en el proxy reverso (firma HMAC de la identidad de SEP); se comparte con SEP |
| `NEXT_PUBLIC_API_URL` | web | `https://sep.org/voluntarios/api` (a fijar en origen SEP) |
| `NEXT_PUBLIC_WEB_ORIGIN` | web | `https://sep.org` (a fijar en origen SEP) |
| `SISMO_FRAME_ANCESTORS` | infra/docker-compose.yml + `.env` | placeholder (existe) |
| `SISMO_DB_*` | api | instancia postgres de SEP (BD separada `sismo_sep`) |

---

## 7. Pasos de despliegue (resumen)

1. **SISMO api:** implementar verificación HMAC de `x-sismo-sep-user`/`x-sismo-sep-sig`
   (receta B.1–B.3); asegurar `SISMO_SEP_API_TOKEN` y `SISMO_SEP_PROXY_SECRET`
   configurados.
2. **SISMO web:** `basePath: "/voluntarios"` + `NEXT_PUBLIC_API_URL` al mismo
   origen (receta B.5).
3. **SISMO api:** exponerla en `/voluntarios/api` (root-path o rewrite del
   proxy, receta B.6).
4. **SEP:** reverse proxy `/voluntarios` y `/voluntarios/api` → SISMO; inyectar
   identidad firmada en esas rutas (recetas C.1–C.2); agregar enlace en sidebar.
5. **SEP:** campana en header vía Partner API (receta C.3); limpiar
   `sismo_session` en logout.
6. **Verificar:** usuario SEP entra a `/voluntarios` → sin login ve sus
   actividades; usuario externo → login Google; logout SEP limpia sesión.

> Los bloques de código exactos (HMAC, web `basePath`, proxy SEP, Partner API)
> están en `docs/SEP_INTEGRATION_COOKBOOK.md`.
