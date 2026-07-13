# Integración SISMO ⇄ SEP — Proxy reverso (SISMO en subruta de SEP)

> ## Decisión actual (jul-2026)
>
> **Mecanismo elegido: proxy reverso.** SISMO se sirve como su propia
> aplicación Next dentro de una ruta del dominio de SEP
> (`https://sep.org/voluntarios/`). SEP solo agrega un enlace en su menú y
> configura un proxy inverso que manda el tráfico de esa ruta hacia los
> contenedores de SISMO. SISMO mantiene su API, su BD y su lógica; SEP no
> compila ni embebe el código de SISMO.
>
> **Por qué cambiamos de Micro-frontend (Module Federation):** evaluamos
> empaquetar SISMO como remote MF para que SEP lo montara dentro de su propio
> header/sidebar. Ese enfoque **no es viable con el App Router de Next 15**
> (ver apéndice "Por qué descartamos Module Federation"). El proxy reverso sí
> es 100% compatible con App Router y exige mucho menos trabajo de SEP, por eso
> lo adoptamos.
>
> **Identidad:** SEP, a través de su proxy, le pasa a SISMO la identidad del
> usuario ya autenticado firmada por HMAC. SISMO la verifica y emite su propia
> cookie de sesión, así el usuario de SEP entra a SISMO **sin volver a loguearse**.
>
> **Notificaciones en el header de SEP:** SISMO expone la *Partner API*
> (server-to-server) que el backend de SEP consulta para pintar la campana.

---

## Estado de la integración

**Hecho en el lado SISMO (listo para usar):**

- **Partner API** (`apps/api/app/api/v1/partner.py`): implementada. SEP la
  consulta con `Bearer <SISMO_SEP_API_TOKEN>` para mostrar las notificaciones de
  SISMO en su header. Contrato en el cookbook.
- **Flujo de identidad SEP (alternativa por código):** `POST /api/v1/auth/sep-login`
  (server-to-server, `Bearer <SISMO_SEP_API_TOKEN>` → one-time `code`) y
  `POST /api/v1/auth/exchange` ya existen. Se usa si SEP prefiere generar un
  `code` en vez de firmar headers.
- **Infra cableada:** `SISMO_SEP_API_TOKEN`, `SISMO_SEP_PROXY_SECRET`,
  `SISMO_FRAME_ANCESTORS`, `SISMO_API_CORS_ORIGINS` en
  `infra/docker-compose.yml` + `.env`.
- **Regla de negocio:** los tags de zona y el feed de descubrimiento excluyen
  las actividades que el usuario ya creó **y** las en las que ya está inscrito.
- SISMO usa **su propia BD** (postgres, BD separada `sismo_sep`).

**Pendiente en el lado SISMO:**

- **Verificación del header firmado de SEP (HMAC):** implementar la verificación
  de `x-sismo-sep-user` / `x-sismo-sep-sig` en la API (receta B.1–B.3 del
  cookbook) usando `SISMO_SEP_PROXY_SECRET`. Es lo que realmente "logea" al
  usuario de SEP en SISMO sin pedirle credenciales.
- **Configurar el web para la subruta:** `basePath: "/voluntarios"` en
  `next.config.ts` y `NEXT_PUBLIC_API_URL=https://sep.org/voluntarios/api`.
- **Desplegar** web+api en el server de SEP detrás del proxy (mismo origen), con
  BD postgres separada.
- (Opcional, solo estético) Si se quiere que SISMO se vea idéntico a SEP,
  replicar el header/sidebar de SEP en la UI de SISMO (pedirles el markup/CSS).

**Depende de SEP (decisiones suyas):**

- Agregar la opción "Voluntariados" en su sidebar apuntando a
  `https://sep.org/voluntarios/`.
- Configurar el reverse proxy para enrutar `/voluntarios` y `/voluntarios/api`
  hacia SISMO, e inyectar la identidad firmada en esas rutas.
- Origen/dominio final (fija `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_ORIGIN`).
- Limpiar la cookie `sismo_session` en su logout global.

---

## 1. Topología de despliegue

```
  SEP (su sitio, sep.org)
  ┌──────────────────────────────────────────────────────────┐
  │ Header/sidebar de SEP  ·  enlace "Voluntariados"          │
  │                                                            │
  │  Cuando el usuario entra a /voluntarios  ──┐               │
  └────────────────────────────────────────────┼──────────────┘
                                                │ (reverse proxy de SEP)
                                                ▼
  SISMO (contenedores en el MISMO server/dominio de SEP)
  ┌──────────────────────────────────────────────────────────┐
  │  web (Next.js) en  /voluntarios      api (FastAPI) en      │
  │                              /voluntarios/api             │
  │  · renderiza la página completa de SISMO (su propio        │
  │    header/navegación, o uno que imita al de SEP)           │
  │  · postgres (BD propia sismo_sep) · redis                  │
  └──────────────────────────────────────────────────────────┘
```

- SISMO **web** se sirve íntegro en `/voluntarios` (no es un pedazo embebido,
  es una página más del sitio de SEP, bajo el mismo dominio).
- SISMO **api/postgres/redis** corren como contenedores en el server de SEP. La
  API se sirve en el mismo origen (`sep.org/voluntarios/api`) para que la cookie
  de sesión de SISMO sea *first-party* y no haya problemas de CORS ni de
  cookies de terceros.
- SISMO usa **su propia BD** (separada dentro de la instancia postgres de SEP).

---

## 2. Identidad y autenticación

### 2.1 Usuarios de SEP (entran sin re-login)

1. El usuario inicia sesión normalmente en SEP.
2. Cuando SEP sirve cualquier request a `/voluntarios*`, su proxy **inyecta un
   "pase" firmado** con la identidad del usuario (`x-sismo-sep-user` +
   `x-sismo-sep-sig`, ver §A del cookbook). Solo se inyecta si el usuario tiene
   sesión SEP.
3. La API de SISMO recibe ese header, **verifica la firma** HMAC con
   `SISMO_SEP_PROXY_SECRET` (secreto compartido solo entre SEP y SISMO). Si es
   válido, crea/actualiza el usuario SEP en su BD y le devuelve al navegador la
   cookie de sesión de SISMO (`sismo_session`).
4. A partir de ahí, el navegador ya lleva la cookie y SISMO lo trata como
   usuario logueado. **El usuario de SEP no ve ningún login de SISMO.**

> *Alternativa:* en vez de firmar headers, SEP puede generar un `code` una vez
> vía `POST /api/v1/auth/sep-login` y SISMO lo redime con
> `POST /api/v1/auth/exchange`. El flujo por header HMAC es el más simple para
> proxy reverso.

### 2.2 Usuarios externos (login propio de SISMO)

Para las rutas de login de SISMO (`/voluntarios/login*`,
`/voluntarios/api/v1/auth/*`) el proxy de SEP **no** inyecta la identidad. Así,
un visitante sin sesión SEP ve el login de Google de SISMO y se autentica por su
cuenta.

### 2.3 Logout

Es el logout de SEP. SEP además debe borrar la cookie `sismo_session` (mismo
origen `sep.org`), para que al salir de SEP también se cierre la sesión de SISMO.

---

## 3. Qué tiene que hacer cada quien (paso a paso)

Esta sección explica, en orden, las tareas de cada lado y **qué implica cada
paso** (no solo el comando). El objetivo: que tanto tú (SISMO) como el equipo de
SEP sepan exactamente qué toca hacer.

### 3.1 SISMO (tu equipo)

**Paso 1 — Hacer que SISMO "viva" en la subruta `/voluntarios`.**
En `apps/web/next.config.ts` agregás `basePath: "/voluntarios"`. Esto le dice a
Next: "todas tus páginas, archivos y enlaces internos van prefijados con
`/voluntarios`". *Por qué importa:* el proxy de SEP necesita distinguir qué
pedidos son de SISMO (`/voluntarios/...`) y cuáles del resto de SEP; el
`basePath` lo hace automático sin que toques cada link. (Receta B.5 del
cookbook.)

**Paso 2 — Apuntar el web a la API en el mismo dominio.**
En el `.env` del web en el server de SEP ponés
`NEXT_PUBLIC_API_URL=https://sep.org/voluntarios/api` y
`NEXT_PUBLIC_WEB_ORIGIN=https://sep.org`. *Por qué importa:* el navegador del
usuario llama a la API desde el mismo dominio `sep.org`, así la cookie de sesión
es *first-party* (no se bloquea por políticas de cookies de terceros) y no hay
problemas de CORS.

**Paso 3 — Verificar la identidad que SEP te manda (HMAC).**
Implementás en la API la verificación de los headers firmados
`x-sismo-sep-user` / `x-sismo-sep-sig` (receta B.1–B.3 del cookbook) usando
`SISMO_SEP_PROXY_SECRET`. *Por qué importa:* es el mecanismo que "logea" al
usuario de SEP en SISMO sin que este teclee nada. Si la firma no coincide,
SISMO ignora el header y trata al visitante como no autenticado (flujo normal de
login). Sin este paso, SEP no podría pasarte la identidad de forma segura.

**Paso 4 — Desplegar en el server de SEP.**
Llevás los contenedores de SISMO (web, api, postgres con BD `sismo_sep`,
redis) al server de SEP, detrás del proxy que SEP configura. *Por qué importa:*
SISMO queda como una sección más del sitio de SEP, bajo su dominio.

**Paso 5 — Dejar la Partner API operativa.**
Ya está implementada; solo hay que asegurar que `SISMO_SEP_API_TOKEN` esté
configurado en el deploy. *Por qué importa:* es lo que SEP usa para mostrar la
campana de notificaciones de SISMO en su header general (ver §4).

**Paso 6 — (Opcional, solo estético) Igualar el look con SEP.**
En el proxy reverso full-page, SISMO muestra su **propia página completa** (su
header/navegación propios, igual que hoy en el sitio de SISMO). Si querés que se
vea idéntico al sitio de SEP, replicás el header/sidebar de SEP dentro de la UI
de SISMO; para eso les pedís a ellos el markup/CSS de su header y sidebar. *Por
qué importa:* no es obligatorio para que funcione, pero mejora la continuidad
visual. Si no lo hacés, SISMO se verá como "su propio sitio" dentro de la ruta de
SEP, lo cual también es válido.

### 3.2 SEP (ellos)

**Paso 1 — Configurar el reverse proxy.**
Hacen que todo lo que llegue a `/voluntarios` y `/voluntarios/api` se reenvíe a
los contenedores de SISMO. *Por qué importa:* es literalmente "esta parte del
sitio la atiende la app de SISMO". Es la única pieza de infra que SEP debe
montar para el tráfico de SISMO. (Rutas sugeridas en §C.2 del cookbook.)

**Paso 2 — Inyectar la identidad firmada.**
En su proxy, **solo si el usuario tiene sesión SEP**, arman e inyectan los
headers `x-sismo-sep-user` y `x-sismo-sep-sig` (firmados con
`SISMO_SEP_PROXY_SECRET`, que comparte con SISMO) en cada request a
`/voluntarios*`. *Por qué importa:* así SISMO sabe quién es el usuario y lo
loguea sin pedirle credenciales. Es el equivalente a "SEP le pasa el pase a
SISMO". (Receta C.1 del cookbook.)

**Paso 3 — No inyectar la identidad en los logins de SISMO.**
En `/voluntarios/login*` y `/voluntarios/api/v1/auth/*` **no** se inyecta el
header, para que los usuarios externos puedan loguearse con Google en SISMO.
*Por qué importa:* si siempre inyectaran identidad, un usuario externo nunca
podría usar el login propio de SISMO.

**Paso 4 — Agregar la opción en su sidebar.**
Añaden un enlace "Voluntariados" que apunte a `https://sep.org/voluntarios/`.
*Por qué importa:* desde el punto de vista de SEP, esto es solo un ítem de menú
más, como cualquier otra sección. No embeben código de SISMO; solo enlazan.

**Paso 5 — Pintar la campana de notificaciones de SISMO.**
Su backend, para el usuario actual, consulta la Partner API de SISMO
(`GET /partner/v1/users/{sep_user_id}/notifications/summary` con
`SISMO_SEP_API_TOKEN`) y muestra el contador en el header que SEP ya usa en todo
el sitio. *Por qué importa:* el usuario de SEP ve sus notificaciones de
voluntariado sin entrar a la sección. (Receta C.3 del cookbook.)

**Paso 6 — Limpiar la sesión de SISMO al salir.**
En su logout global, además de cerrar la sesión de SEP, borran la cookie
`sismo_session`. *Por qué importa:* si no lo hacen, el usuario podría seguir
logueado en SISMO aunque haya salido de SEP.

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
| `SISMO_SEP_PROXY_SECRET` | api | **usado en el proxy reverso** (firma HMAC de la identidad de SEP); se comparte con SEP |
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
   identidad firmada en esas rutas (recetas C.1–C.2); agregar enlace en sidebar
   (Paso 4 de §3.2).
5. **SEP:** campana en header vía Partner API (receta C.3); limpiar
   `sismo_session` en logout (Paso 6 de §3.2).
6. **Verificar:** usuario SEP entra a `/voluntarios` → sin login ve sus
   actividades; usuario externo → login Google; logout SEP limpia sesión.

> Los bloques de código exactos (HMAC, web `basePath`, proxy SEP, Partner API)
> están en `docs/SEP_INTEGRATION_COOKBOOK.md`.

---

## Apéndice — Por qué descartamos Module Federation (histórico)

Se evaluó empaquetar SISMO como remote MF para que SEP lo montara dentro de su
shell. No es viable con el App Router de Next 15:

- `@module-federation/nextjs-mf` (incluso su build de compatibilidad `next`)
  falla explícitamente: `App Directory is not supported by nextjs-mf. Use only
  pages directory`.
- `@module-federation/enhanced` (el `ModuleFederationPlugin` de webpack directo)
  compila el entry federado pero no resuelve `react-dom/client` de Next.

Lograr MF real exigiría migrar SISMO a Pages Router o re-arquitectar la UI como
SPA cliente: re-esfuerzo grande y fuera de alcance. Por eso se adoptó el proxy
reverso, que es compatible con App Router y requiere mucho menos del lado de SEP.
