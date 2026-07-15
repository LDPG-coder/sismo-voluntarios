# Sismo Voluntarios — Documentación Técnica

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Tunnel                     │
│                  (cloudflared sidecar)                   │
└───────────┬─────────────────────────────┬───────────────┘
            │                             │
            ▼                             ▼
┌───────────────────┐         ┌───────────────────────┐
│   api.sismo.lat   │         │     sismo.lat         │
│   (API FastAPI)   │         │   (Next.js Web)       │
│   :8000           │◄────────│   :3000               │
└───────┬───────────┘         └───────────────────────┘
        │
        ▼
┌───────────────┐    ┌───────────────┐
│  PostgreSQL   │    │    Redis      │
│  :5432        │    │    :6379      │
└───────────────┘    └───────────────┘
```

### Stack Tecnológico

| Componente | Tecnología | Versión |
|---|---|---|
| Frontend | Next.js (React) | 15.5.20 |
| Backend | FastAPI (Python) | 0.139.0 |
| Base de datos | PostgreSQL | 16-alpine |
| Cache/Rate-limit | Redis | 7-alpine |
| ORM | SQLAlchemy | 2.0.51 |
| Migraciones | Alembic | 1.18.5 |
| Tunnel | Cloudflare Tunnel | latest |
| Containerización | Docker Compose | v2 |

---

## Historial de Cambios de Dependencias

Registro de actualizaciones de versiones y su justificación (ver `apps/web/package.json`,
`apps/web/package-lock.json` y `apps/api/requirements.txt`).

| Fecha | Componente | De → A | Razón del cambio |
|---|---|---|---|
| 2026-07-13 | Next.js | `15.0.3` → `15.5.20` | Cierre de CVEs de seguridad. `15.0.3` era vulnerable a **CVE-2025-29927** y **CVE-2025-57822** (bypass de autorización en el middleware de Next, *críticos*), además de múltiples CVEs de DoS/SSRF. Se evaluó `15.5.3` pero también estaba vulnerado por **CVE-2025-66478**, así que se pasó a la última estable de la línea 15.x (`15.5.20`). `eslint-config-next` se emparejó a la misma versión. El build de producción se verificó exitoso con `15.5.20`. |
| 2026-07-13 | PyJWT (`apps/api`) | `>=2.9.0` → `>=2.10.1` | **CVE-2024-53861** (falsificación de token JWT vía parámetro `kwarg`). |
| 2026-07-13 | httpx (`apps/api`) | `>=0.27.0` → `>=0.28.1` | **CVE-2024-47081** (fuga de credenciales mediante redirect). |

> **Nota de contexto:** el middleware de Next en este proyecto (`apps/web/middleware.ts`)
> únicamente fija headers de seguridad (CSP/HSTS) y **no** realiza autorización — esta se
> enforce en el backend FastAPI (`require_session`). Por tanto los CVEs de *bypass de
> middleware* no eran explotables en la práctica aquí, pero se actualizó de todos modos para
> mantener el árbol de dependencias libre de CVEs conocidos.

---

## Estructura del Repositorio

```
sismo-voluntarios/
├── apps/
│   ├── api/                    # Backend Python
│   │   ├── app/
│   │   │   ├── api/v1/         # Endpoints REST
│   │   │   ├── core/           # Config, errores, logging
│   │   │   ├── db/             # Modelos SQLAlchemy
│   │   │   ├── middleware/     # CSRF, rate-limiting
│   │   │   ├── pipeline/       # OAuth, sesiones
│   │   │   └── ai/             # Servicio de sugerencias IA
│   │   ├── alembic/            # Migraciones de BD
│   │   ├── Dockerfile          # Producción (multi-stage)
│   │   ├── Dockerfile.dev      # Desarrollo (hot-reload)
│   │   └── requirements.txt
│   └── web/                    # Frontend Next.js
│       ├── app/                # App Router (pages)
│       ├── components/         # Componentes React
│       ├── lib/auth/           # Auth helpers (server-side)
│       ├── Dockerfile          # Producción (standalone)
│       ├── Dockerfile.dev      # Desarrollo
│       └── package.json
├── infra/
│   ├── docker-compose.yml      # Producción
│   ├── docker-compose.dev.yml  # Desarrollo
│   ├── .env                    # Secrets de producción
│   └── .env.example            # Template
├── dev.sh                      # Script de gestión dev
└── .env.example                # Template raíz
```

---

## Requisitos Previos

### Producción (servidor)

- Docker Engine 24+ con Docker Compose v2
- 2GB RAM mínimo (512MB PG + 1GB API + 1GB Web + 128MB Redis)
- Puerto 5432, 8000, 3000 libres (o mapeados)
- Cuenta de Cloudflare con Tunnel configurado
- Google OAuth Client ID/Secret
- (Opcional) API Key de OpenAI para sugerencias IA

### Desarrollo (local)

- Docker Engine con Docker Compose v2
- 4GB RAM disponible para Docker

#### Compatibilidad multi-sistema operativo

- **Linux**: funciona tal cual. Los volúmenes se montan con rendimiento nativo.
- **macOS**: Docker Desktop. Los bind-mounts son lentos; por eso el
  `docker-compose.dev.yml` usa `:cached` en el código (acelera lectura).
  Si usas Apple Silicon, las imágenes se emulan; para máxima velocidad
  construye en nativo con BuildKit:
  ```bash
  DOCKER_BUILDKIT=1 docker compose build
  ```
- **Windows**: **usa WSL2** (Windows Subsystem for Linux 2). No corras los
  comandos en PowerShell/CMD nativo con los volúmenes del repo en el disco
  de Windows (`C:\`), porque Docker monta eso muy lento y con problemas de
  permisos. Pasos recomendados:
  1. Instala WSL2 (Ubuntu) y Docker Desktop con la integración de WSL2
     habilitada (`Settings → Resources → WSL Integration`).
  2. Clona el repositorio **dentro** del filesystem de WSL2
     (p. ej. `~/sismo` en `/home/tu-usuario`), no en `/mnt/c/...`.
  3. Ejecuta `./dev.sh` desde la terminal de WSL2 (bash). Los scripts
     `.sh` ya tienen saltos de línea LF gracias a `.gitattributes`.
  4. Accede a los servicios desde el navegador de Windows vía
     `http://localhost:<puerto>` (Docker reenvía los puertos del WSL2).
  - Opcional: si prefieres PowerShell, los comandos equivalen a
    `docker compose -f infra/docker-compose.dev.yml up -d --build`.

---

## Despliegue en Desarrollo

### Inicio Rápido

```bash
# 1. Clonar el repositorio
git clone <repo-url> && cd sismo-voluntarios

# 2. Configurar variables de entorno (usa valores por defecto de dev)
cp .env.example .env
cp infra/.env.example infra/.env

# 3. Levantar todos los servicios
./dev.sh up

# 4. Ejecutar migraciones de base de datos
./dev.sh migrate
```

### Servicios de Desarrollo

| Servicio | URL | Puerto |
|---|---|---|
| Web (Next.js) | http://localhost:3001 | 3001 |
| API (FastAPI docs) | http://localhost:8000/docs | 8000 |
| PostgreSQL | localhost:5432 | 5432 |

### Comandos del Script `dev.sh`

```bash
./dev.sh up              # Levantar servicios (api+web+postgres+redis)
./dev.sh down            # Detener servicios
./dev.sh restart         # Reiniciar servicios
./dev.sh logs            # Ver logs de todos los servicios
./dev.sh logs-api        # Ver solo logs de la API
./dev.sh logs-web        # Ver solo logs del Web
./dev.sh migrate         # Ejecutar migraciones (alembic upgrade head)
./dev.sh migrate-make "msg"  # Crear nueva migración
./dev.sh shell           # Shell bash dentro del contenedor API
./dev.sh db              # Consola psql de PostgreSQL
./dev.sh status          # Estado de los contenedores
./dev.sh build           # Reconstruir imágenes
./dev.sh test-api        # Correr pytest de la API (container efímero)
./dev.sh test-web        # Typecheck del frontend
./dev.sh lint            # Ejecutar linters (ruff + tsc)
./dev.sh clean           # Detener y ELIMINAR volúmenes (DESTRUCTIVO)
```

### Arquitectura de Desarrollo

- **Hot-reload**: Tanto API (uvicorn --reload) como Web (next dev) tienen hot-reload
- **Volúmenes**: El código fuente se monta directamente en los contenedores
  (con `:cached` en macOS/Windows para acelerar la lectura)
- **Base de datos**: Datos persisten en el volumen `sismo_pgdata_dev`
- **Network**: Todos los servicios en la red `sismo-dev` (nombre estable `sismo-dev`)
- **Redis**: incluido por defecto para que la API funcione completa (rate-limit, IA)

### Puertos y variables abstractas (dev)

Todos los puertos se toman de variables de entorno con defaults sensatos:

| Variable | Default | Uso |
|---|---|---|
| `SISMO_API_PORT` | `8000` | Puerto de la API |
| `SISMO_WEB_PORT` | `3001` | Puerto del frontend dev |
| `SISMO_PG_PORT` | `5432` | Puerto de PostgreSQL mapeado al host |

Para levantar en puertos distintos (p. ej. evitar conflictos):
```bash
SISMO_API_PORT=9000 SISMO_WEB_PORT=9001 ./dev.sh up
```

### Pruebas rápidas en desarrollo

Los tests de API corren en un container efímero (perfil `test`) **sin necesidad
de rebuild** del stack, reutilizando los servicios de postgres/redis ya activos:

```bash
./dev.sh test-api     # pytest dentro del container api (perfil test)
./dev.sh test-web     # typecheck del frontend
```

`COMPOSE_PROFILES=test` also habilita el servicio `test-api` al hacer `up`.

### Desacoplar servicios y conectar otros containers

La configuración de producción está dividida en dos archivos:

- **`docker-compose.yml`** (base): solo `api` + `web` + `cloudflared`
  (este último tras el perfil `tunnel`). No incluye postgres/redis, así
  que apunta a servicios externos con `SISMO_DB_HOST` / `SISMO_REDIS_URL`.
- **`docker-compose.override.yml`** (auto-cargado): añade `postgres` y
  `redis` **locales** con healthchecks y conecta `api`/`web` a ellos.

Levantar el stack completo local (postgres + redis incluidos):
```bash
cd infra
docker compose up -d --build          # carga .yml + .override.yml
```

Levantar SOLO api/web contra una BD o Redis externos:
```bash
docker compose -f docker-compose.yml up -d --build
# + en infra/.env: SISMO_DB_HOST / SISMO_DB_PORT / SISMO_REDIS_URL
```

La red se llama **`sismo`** (sin prefijo de proyecto) para que otros
stacks se conecten por nombre de servicio. Para enlazar un container externo:
```bash
docker network connect sismo <otro-container>   # ya puede usar http://api:8000
```
O bien define la misma red como externa en tu otro compose (ver
`infra/docker-compose.network.yml`).

### Convivir Dev y Producción a la vez

Dev y Prod usan **nombres de proyecto distintos**, así que pueden correr
simultáneamente sin colisionar:

- **Dev**: project `sismo-dev` (lo fija `dev.sh` vía `COMPOSE_PROJECT_NAME`).
  Containers: `sismo-dev-api-1`, `sismo-dev-web-1`, etc. Red `sismo-dev`.
- **Prod**: project `infra` (nombre del directorio). Containers: `infra-*`.
  Red `sismo`.

Para levantar ambos en paralelo:
```bash
./dev.sh up                       # dev en sismo-dev-*
cd infra && docker compose up -d  # prod en infra-*
```
Ambos comparten el host vía `127.0.0.1` en puertos diferentes
(`SISMO_API_PORT`/`SISMO_WEB_PORT` distintos en cada entorno).

### Builds multi-arquitectura (Apple Silicon / ARM)

Las imágenes se construyen con BuildKit. Para generar artefactos nativos
en otra arquitectura (p. ej. `linux/arm64` en Mac M-series) sin emulación:
```bash
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -f apps/api/Dockerfile -t sismo/api:local apps/api
```
O, con compose, define `platform` por servicio en los Dockerfiles/compose
según tu objetivo.

---

## Desarrollo Local — ver todas las secciones

Esta guía explica cómo un dev puede levantar el proyecto y visualizar **todas**
las secciones (públicas + protegidas + modo SEP), sin depender de Google OAuth
ni de invitaciones. Incluye los cambios mínimos de código que ya vienen
implementados en el branch (bypass de login dev + script de seed).

> **Solo desarrollo.** El bypass de login y el secreto de dev **nunca** deben
> estar en producción. La ruta `dev-login` retorna 404 si `NODE_ENV=production`.

### Resumen de pasos (quickstart)

Para ver **todas** las páginas en local (públicas + protegidas + modo SEP) en
un dev limpio, basta con esto:

```bash
cp .env.example .env                # en dev, la API y el web comparten apps/api/.env (cópialo desde este .env)
cp infra/.env.example infra/.env
./dev.sh up                         # api + web + postgres + redis
./dev.sh migrate                    # alembic upgrade head
./dev.sh seed                       # crea admin dev (11111111-…) + 5 actividades
```

Luego, en el navegador (Safari/Chrome), abre **exactamente esta URL**:

```
http://localhost:3001/auth/dev-login
```

Te redirige a `/voluntarios` ya logueado como admin. Desde ahí navega a
`/mis-actividades`, `/perfil`, `/voluntarios/crear`, `/admin/usuarios`, etc.

> **Regla de oro del host:** usa siempre `localhost`, **nunca `127.0.0.1`**,
> en navegador, API y CORS. La cookie de sesión es *host-only* para el host que
> usaste; si entras por `127.0.0.1:3001` pero la API corre en `localhost:8000`,
> el navegador no envía la cookie y las actividades quedan en "cargando"
> eterno. Los cambios de CSP/middleware que permiten esto ya vienen en el
> código (relajados solo cuando `NODE_ENV !== "production"`), así que **no**
> requieren pasos manuales.

### Gates que bloqueaban ver todo en local (y cómo se resolvieron)

1. **Login OAuth + invitaciones**: `/login` redirige a Google y el callback
   exige que el usuario ya exista en BD. → Se crea el usuario dev por seed.
2. **Secciones protegidas** (cookie de sesión): `/mis-actividades`, `/perfil`,
   `/voluntarios/crear`, `/voluntarios/[id]/editar`, `/voluntarios/[id]/admin`,
   `/admin/usuarios`, sugerencias IA. → Se habilita vía bypass de login dev.
3. **Mismatch de `SISMO_SESSION_SECRET` en dev (bug corregido)**: el web dev
   **no** recibía `apps/api/.env`, así que firmaba la cookie con el fallback de
   dev mientras la API verificaba con el secret real → login siempre fallaba.
   → `infra/docker-compose.dev.yml` ahora inyecta `env_file: ../apps/api/.env`
   al servicio `web`, alineando ambos secretos.
4. **Chrome SEP vs externo**: el layout elige `AppShell` (usuario SEP) o
   `ExternalShell` (usuario externo/OAuth) según `auth_source` (ver subsección D).
5. **IA**: requiere `SISMO_OPENAI_API_KEY` (la UI se ve igual; el endpoint 500ea
   sin key).

### A. Base

```bash
cp .env.example .env                # en dev, la API y el web comparten apps/api/.env (cópialo desde este .env)
cp infra/.env.example infra/.env
./dev.sh up
./dev.sh migrate                    # alembic upgrade head
```

### B. Crear el usuario admin dev

Responde al "gate 1". El web (`dev-login`) usa un UUID fijo que **debe** existir
en BD: `11111111-1111-1111-1111-111111111111`, email `dev@sismo.local`,
`role=admin`, `status=active`, `referral_code=DEVADMIN`, `tenant_id` = `MVP_TENANT_ID`.

**Opción script (recomendada):**

```bash
./dev.sh seed
```

Crea el admin dev (idempotente: skip si ya existe) e inserta 5 actividades de
ejemplo para poblar Lista/Semana/Mes/Gantt.

**Opción SQL manual (alternativa):**

```bash
./dev.sh db
INSERT INTO users (id, email, role, status, referral_code, tenant_id, created_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'dev@sismo.local', 'admin',
        'active', 'DEVADMIN', '00000000-0000-0000-0000-000000000001', now());
```

### C. Login sin Google (bypass dev)

Una sola vez, abre en el navegador:

```
http://localhost:3001/auth/dev-login
```

Esto setea la cookie de sesión de admin fijo (`sismo_session` HttpOnly +
`XSRF-TOKEN`) y redirige a `/voluntarios` ya logueado. **Solo existe si
`NODE_ENV !== "production"`** (la ruta retorna 404 en prod, no se compila).

> **No uses el botón de Google** en `/login`: inicia el flujo OAuth real, que
> no opera en local. El bypass `dev-login` es la única vía de login en dev.
>
> **Usa `localhost`, no `127.0.0.1`** (ver regla de oro arriba). Si tras entrar
> ves el skeleton "cargando" para siempre o botones que no responden, casi
> siempre es porque se entró por `127.0.0.1` o el navegador cacheó un CSP
> viejo: haz un *hard refresh* (`Cmd/Ctrl+Shift+R`).
>
> Los detalles de implementación que hacen posible esto (cookie seteada en un
> `200` + `meta-refresh` relativo, y el CSP de dev relajado para `unsafe-eval`
> y `connect-src http://localhost:*`) ya están en el código y no requieren
> acción manual.

### D. Chrome según el tipo de usuario (SEP vs externo)

El chrome se elige por el tipo de cuenta en `apps/web/app/(app)/layout.tsx`,
según `user.auth_source` (no hay iframe ni contexto embebido):

- **Usuario SEP** (`auth_source === "sep"`) → `AppShell`: SISMO renderiza su
  propio header + sidebar que imitan al sitio del SEP.
- **Usuario externo / OAuth** (Google) → `ExternalShell`: **sin** ese sidebar;
  navega con el panel flotante (escritorio) y el botón FAB (teléfono). Ver
  `docs/external-users-access.md`.

Para probar el chrome de usuario SEP en local, crea/usa una cuenta con
`auth_source = "sep"` (p. ej. vía el flujo `sep-login`); el bypass `dev-login`
crea un admin externo.

### E. Datos de ejemplo

El seed ya inserta actividades de ejemplo. Si no ejecutaste `./dev.sh seed`
(completo), las vistas de calendario quedarán vacías pero **las secciones se
ven** igual.

### F. IA (opcional)

Para que `/ai/suggest` funcione, define `SISMO_OPENAI_API_KEY` en
`SISMO_OPENAI_API_KEY` en el `.env` (o en `apps/api/.env` en dev). Sin la key la UI aparece igual pero el endpoint responde 500.

### G. Solución de problemas comunes (dev)

Síntomas reales encontrados al levantar el proyecto en local y su causa:

| Síntoma | Causa | Solución |
|---|---|---|
| `/login` con un botón gigante de Google y no entras | Usaste el flujo OAuth en vez del bypass | Entra por `http://localhost:3001/auth/dev-login` |
| Safari: "no se pudo encontrar `https://localhost:3001/…`" | CSP `upgrade-insecure-requests` (ya quitado en dev) o se usó `127.0.0.1` | Usa `localhost`; el fix ya está en `middleware.ts` |
| Skeleton "cargando" eterno en `/voluntarios` | Cookie host-only no coincide: entraste por `127.0.0.1` pero la API está en `localhost` | Usa `http://localhost:3001/…` en todo el flujo |
| Botones/no hay interacción (solo HTML estático) | `script-src` bloqueaba `eval` de React Refresh (ya relajado en dev) o CSP cacheado | *Hard refresh*; el fix ya está en `middleware.ts` |
| Actividades no cargan pero el resto sí | `connect-src` bloqueaba el fetch HTTP a la API (ya relajado en dev) | *Hard refresh*; el fix ya está en `middleware.ts` |
| `403/401` en llamadas a la API desde el navegador | CORS no incluía el origen usado | El compose dev ya permite `localhost:3001` y `127.0.0.1:3001`; usa `localhost` |

Todos los fixes mencionados arriba son **código que ya viene en el branch** y
se aplican solo cuando `NODE_ENV !== "production"` (ver `middleware.ts` y
`docker-compose.dev.yml`). En producción el CSP y el bypass quedan intactos.

---

## Despliegue en Producción

### Configuración Inicial del Servidor

```bash
# 1. Clonar el repositorio
git clone <repo-url> && cd sismo-voluntarios

# 2. Configurar secrets de producción
cd infra
cp .env.example .env
# Editar .env con valores reales:
#   SISMO_DB_PASSWORD=<password-fuerte>
#   SISMO_SESSION_SECRET=$(openssl rand -hex 32)
#   CLOUDFLARE_TUNNEL_TOKEN=<token-de-cloudflare>
#   NEXT_PUBLIC_API_URL=https://api.sismo.lat
#   NEXT_PUBLIC_WEB_ORIGIN=https://sismo.lat

# 3. Generar los Docker secrets (archivos en infra/secrets/, gitignored)
./setup-secrets.sh
```

> **Secretos**: `infra/.env` es la UNICA fuente de configuracion del stack.
> Los 3 secretos criticos de la API (`SISMO_DB_PASSWORD`,
> `SISMO_SESSION_SECRET`, `SISMO_GOOGLE_CLIENT_SECRET`) NO se inyectan como
> `environment` (no aparecen en `docker inspect`): se montan como archivos
> en `/run/secrets` y el `docker-entrypoint.sh` los exporta en runtime.
> El token de Cloudflare queda como `environment` porque la imagen de
> cloudflared no trae shell (no se puede usar shim).

### Archivo `.env` de Producción (infra/.env)

```bash
# Base de datos
SISMO_DB_NAME=sismo
SISMO_DB_USER=sismo
SISMO_DB_PASSWORD=<password-fuerte-unique>

# CORS
SISMO_API_CORS_ORIGINS=https://sismo.lat,https://www.sismo.lat,https://api.sismo.lat
SISMO_WEB_ORIGIN=https://sismo.lat

# URLs públicas
NEXT_PUBLIC_API_URL=https://api.sismo.lat
NEXT_PUBLIC_WEB_ORIGIN=https://sismo.lat

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=<token>
```

> **Nota (solo desarrollo):** en `infra/docker-compose.dev.yml` la API y el Web
> **comparten** el archivo `apps/api/.env` (cópialo desde `.env.example`) para
> que ambos firmen y verifiquen la cookie de sesión con el mismo
> `SISMO_SESSION_SECRET`. En producción no hay `.env` de API separado: la única
> fuente es `infra/.env` + los Docker secrets descritos arriba. El listado
> completo de variables está en la sección [Variables de Entorno](#variables-de-entorno).

### Levantar en Producción

```bash
cd infra

# 1. Construir y levantar
docker compose up -d --build

# 2. Ejecutar migraciones
docker compose exec api alembic upgrade head

# 3. Verificar estado
docker compose ps

# 4. Verificar salud
curl http://localhost:8000/api/v1/health
```

### Servicios de Producción

`docker compose up` carga `docker-compose.yml` + `docker-compose.override.yml`,
así que postgres y redis locales se incluyen por defecto. Para usar servicios
externos, levanta solo la base: `docker compose -f docker-compose.yml up -d`.

| Servicio | Puerto | Memoria | Notas |
|---|---|---|---|
| PostgreSQL* | 5432 (interno) | 512MB | Del override; datos en volumen `sismo_pgdata` |
| API (FastAPI) | 8000 (interno) | 1GB | 4 workers, healthcheck en `/api/v1/health` |
| Web (Next.js) | 3000 (interno) | 1GB | Standalone mode, non-root user |
| Redis* | 6379 (interno) | 128MB | Del override; rate-limiting y cache |
| Cloudflared | - | 128MB | Tunnel a Cloudflare |

\* Vía `docker-compose.override.yml` (auto-cargado). Puertos reales
parametrizados por `SISMO_API_PORT` / `SISMO_WEB_PORT`.

### Red de Producción

- **Red**: `sismo` (bridge, nombre estable)
- **Exposición**: Solo Cloudflared recibe tráfico externo
- **Puertos expuestos**: Ninguno directamente al host (solo vía Cloudflare)

---

## Migraciones de Base de Datos

### Aplicar migraciones

```bash
# Dev
./dev.sh migrate

# Producción
docker compose exec api alembic upgrade head
```

### Crear nueva migración

```bash
# Dev
./dev.sh migrate-make "descripcion del cambio"

# Producción (no recomendado - hacer en dev y commitear)
docker compose exec api alembic revision --autogenerate -m "descripcion"
```

### Migraciones existentes

| Archivo | Descripción |
|---|---|
| `001_initial.py` | Tablas iniciales (users, activities, etc.) |
| `002_add_activity_end_time.py` | Campo end_time en actividades |
| `003_add_notifications.py` | Tabla de notificaciones |
| `004_add_contact_info.py` | Campo contact_info en actividades |
| `005_add_user_photo.py` | Campo photo_url en usuarios |
| `006_add_user_phone.py` | Campo phone en usuarios |
| `007_add_google_photo_url.py` | Campo google_photo_url en usuarios |
| `008_backfill_google_photo_url.py` | Backfill de google_photo_url |
| `009_add_member_status.py` | Estado de membresía en usuarios |
| `010_add_user_auth_source.py` | `auth_source` + `sep_user_id` (integración SEP) |
| `011_add_activity_external_official.py` | Voluntariado oficial externo en actividades |
| `012_ext_certificate.py` | Constancia para voluntariado externo |
| `013_incubator.py` | Incubadora de proyectos (desconectada en prod) |
| `014_add_activity_internal.py` | Voluntariado interno (flag en actividades, excluyente con externo oficial) |
| `015_sep_code_challenge.py` | `code_challenge` (PKCE S256) en los one-time exchange codes del login SEP |

---

## Variables de Entorno

### API (prefijo `SISMO_`)

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `SISMO_DB_HOST` | No | `localhost` | Host de PostgreSQL |
| `SISMO_DB_PORT` | No | `5432` | Puerto de PostgreSQL |
| `SISMO_DB_NAME` | No | `sismo` | Nombre de la BD |
| `SISMO_DB_USER` | No | `sismo` | Usuario de la BD |
| `SISMO_DB_PASSWORD` | Sí | - | Password de la BD |
| `SISMO_SESSION_SECRET` | Sí* | - | Secret para firmar sesiones (HMAC) |
| `SISMO_COOKIE_SAME_SITE` | No | `lax` | Política `SameSite` de la cookie de sesión (`lax`/`strict`/`none`). `none` solo si SISMO se sirve cross-site (ya no aplica tras quitar el iframe) |
| `SISMO_GOOGLE_CLIENT_ID` | Sí | - | Google OAuth Client ID |
| `SISMO_GOOGLE_CLIENT_SECRET` | Sí | - | Google OAuth Client Secret |
| `SISMO_GOOGLE_REDIRECT_URI` | No | `http://localhost:8000/api/v1/auth/callback` | URI de callback OAuth |
| `SISMO_API_CORS_ORIGINS` | No | `http://localhost:3000` | Orígenes CORS (CSV) |
| `SISMO_WEB_ORIGIN` | No | - | Origen del frontend |
| `SISMO_REDIS_URL` | No | `redis://localhost:6379/0` | URL de Redis |
| `SISMO_OPENAI_API_KEY` | No | - | API Key de OpenAI (para IA) |
| `SISMO_OPENAI_MODEL` | No | `north-mini-code-free` | Modelo de OpenAI |
| `SISMO_SEP_LOGIN_TOKEN` | No | - | Token `Bearer` para el handshake de login SEP (`POST /sep-login`) y logout coordinado (`POST /sep-logout`). Distinto del de Partner API. Vacío = integración SEP deshabilitada |
| `SISMO_SEP_PARTNER_TOKEN` | No | - | Token `Bearer` de solo lectura para la Partner API (notificaciones del header del SEP) |
| `SISMO_SEP_API_TOKEN` | No | - | **Deprecado:** secreto único anterior; SISMO lo usa como fallback si no defines los dos anteriores. Mejor definir los dos |
| `SISMO_SEP_CODE_TTL_SECONDS` | No | 120 | TTL (s) del one-time code de login SEP (PKCE). Corto para limitar replay |
| `SISMO_LOG_LEVEL` | No | `INFO` | Nivel de log |
| `SISMO_ENV` | No | `local` | Entorno (local/dev/staging/prod) |

\* Requerido en producción (la app falla al iniciar si no está seteado con `NODE_ENV=production`)

### Web (Next.js)

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Sí | URL pública de la API (ej: `https://api.sismo.lat`) |
| `NEXT_PUBLIC_WEB_ORIGIN` | Sí | Origen del frontend (ej: `https://sismo.lat`) |
| `NEXT_PUBLIC_BASE_PATH` | No | Ruta base (build-time) cuando SISMO se sirve bajo un sub-path del SEP (ej: `/voluntarios-becarios`). Vacío = raíz |
| `SEP_NAVIGATION_URL` | No | URL (dentro del stack) del endpoint JSON de navegación del SEP que el web consume para el sidebar. Vacío = sidebar de SEP vacío |
| `SISMO_SESSION_SECRET` | Sí* | Mismo secret que la API (para verificar cookies) |
| `INTERNAL_API_URL` | No | URL interna de la API (Docker networking, ej: `http://api:8000`) |

---

## Seguridad

### Autenticación

- **OAuth 2.0** con Google como proveedor de identidad
- **Sesiones** firmadas con HMAC (`sismo_session` cookie, HttpOnly, Secure, SameSite=Lax por defecto; configurable con `SISMO_COOKIE_SAME_SITE`). Como SISMO ya no se embebe en un `<iframe>` cross-site, `SameSite=None` ya no es necesario.
- **CSRF** protección con double-submit cookie pattern (`XSRF-TOKEN`)
- **Rate limiting** por IP: 60 req/min (público), 30 req/min (auth). El autocompletado
  con IA tiene un bucket dedicado más permisivo — 600 req/min + burst 200 — y además un
  tope por usuario de 5000 sugerencias/hora que **solo se cobra al entregar una
  sugerencia** (no en cada tecla/intento cancelado), para no agotarlo mientras se escribe.

### Protección de Rutas

Las páginas protegidas (`/perfil`, `/mis-actividades`, `/voluntarios/crear`, `/voluntarios/[id]/admin`) validan sesión en el **servidor** usando `requireSession()` antes de renderizar.

### Endpoints Protegidos (requieren sesión válida)

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/invite`
- `POST /api/v1/auth/logout`
- `GET /api/v1/activities` (listar)
- `GET /api/v1/activities/{id}` (detalle)
- `GET /api/v1/activities/zones`
- `GET /api/v1/activities/mine`
- `POST /api/v1/activities` (crear)
- `PATCH /api/v1/activities/{id}`
- `DELETE /api/v1/activities/{id}`
- `GET /api/v1/activities/{id}/evidence` (listar comprobantes)
- `POST /api/v1/activities/{id}/evidence` (subir comprobantes, creador)
- `DELETE /api/v1/activities/{id}/evidence/{evidence_id}` (quitar comprobante, creador)
- `POST /api/v1/activities/{id}/join`
- `POST /api/v1/activities/{id}/leave`
- `POST /api/v1/ai/suggest`
- `POST /api/v1/ai/suggest/stream`

### Endpoints Públicos (no requieren sesión)

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/callback`
- `POST /api/v1/auth/exchange`
- `POST /api/v1/auth/referral`

---

## APIs Principales

### Autenticación

```
POST   /api/v1/auth/login          → Redirige a Google OAuth
GET    /api/v1/auth/callback        → Callback de Google
POST   /api/v1/auth/exchange        → Intercambia código one-time por sesión
POST   /api/v1/auth/logout          → Cierra sesión
GET    /api/v1/auth/me              → Usuario actual
POST   /api/v1/auth/invite          → Invitar usuario (requiere sesión)
POST   /api/v1/auth/referral        → Validar código de invitación
```

### Actividades

```
GET    /api/v1/activities           → Listar actividades (público)
                                        Oculta automáticamente las que ya
                                        iniciaron (fecha de inicio pasada).
                                        Accesibles vía enlace directo y desde
                                        "Mis actividades" del organizador.
GET    /api/v1/activities/{id}      → Detalle de actividad (público)
GET    /api/v1/activities/zones     → Zonas disponibles (solo futuras)
GET    /api/v1/activities/mine      → Mis actividades (sesión)
POST   /api/v1/activities           → Crear actividad (sesión)
DELETE /api/v1/activities/{id}      → Cancelar/archivar (sesión)
GET    /api/v1/activities/{id}/evidence          → Comprobantes (sesión)
POST   /api/v1/activities/{id}/evidence          → Subir comprobantes (creador,
                                                    solo si inició y no cerró)
DELETE /api/v1/activities/{id}/evidence/{id}     → Quitar comprobante (creador,
                                                    antes del cierre)
POST   /api/v1/activities/{id}/join    → Unirse (sesión)
POST   /api/v1/activities/{id}/leave   → Salirse (sesión)
GET    /api/v1/activities/{id}/attendees → Asistentes (sesión)
POST   /api/v1/activities/{id}/expand   → Agregar cupos (sesión)
```

### IA

```
POST   /api/v1/ai/suggest          → Sugerencia simple (sesión, rate-limit)
POST   /api/ai/suggest/stream      → Sugerencia con streaming SSE (sesión)
```

---

## Comandos Útiles de Producción

```bash
# Ver logs en tiempo real
docker compose -f infra/docker-compose.yml logs -f

# Reconstruir un servicio específico
docker compose -f infra/docker-compose.yml up -d --build api

# Reiniciar solo la API
docker compose -f infra/docker-compose.yml restart api

# Shell dentro del contenedor API
docker compose -f infra/docker-compose.yml exec api bash

# Consola de PostgreSQL
docker compose -f infra/docker-compose.yml exec postgres psql -U sismo -d sismo

# Verificar estado de Cloudflared
docker logs infra-cloudflared-1 --tail 20

# Limpiar imágenes Docker no usadas
docker system prune -f
```

---

## Troubleshooting

### El contenedor Web no levanta (port 3000 vs 3001)

El Web de producción usa puerto **3000**, el de desarrollo **3001**. Asegúrate de que:
- `docker-compose.yml` (prod) expone `:3000`
- `docker-compose.dev.yml` (dev) expone `:3001`
- Cloudflared apunta a `web:3000` (prod)

### Cloudflared no resuelve los servicios

Verificar que cloudflared esté en la misma red Docker que los servicios:
```bash
docker network inspect infra_sismo-internal
docker inspect infra-cloudflared-1 --format '{{json .NetworkSettings.Networks}}'
```

### Error 502 Bad Gateway

1. Verificar que los contenedores estén corriendo: `docker compose ps`
2. Verificar healthchecks: `docker compose logs api --tail 20`
3. Verificar que Cloudflared pueda resolver los nombres DNS internos

### Error de CSRF

El token CSRF se genera en la cookie `XSRF-TOKEN` y se envía como header `X-CSRF-Token`. Si ves errores 403 en requests POST:
1. Verificar que la cookie esté presente
2. Verificar que el header `X-CSRF-Token` coincida con el valor de la cookie

### Migraciones fallidas

```bash
# Ver migración actual
docker compose exec api alembic current

# Ver historial
docker compose exec api alembic history

# Forzar versión (último recurso)
docker compose exec api alembic stamp head
```
