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
| Frontend | Next.js (React) | 15.0.3 |
| Backend | FastAPI (Python) | 0.139.0 |
| Base de datos | PostgreSQL | 16-alpine |
| Cache/Rate-limit | Redis | 7-alpine |
| ORM | SQLAlchemy | 2.0.51 |
| Migraciones | Alembic | 1.18.5 |
| Tunnel | Cloudflare Tunnel | latest |
| Containerización | Docker Compose | v2 |

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
./dev.sh up              # Levantar servicios
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
./dev.sh build           # Reconstruir imágenes (sin cache)
./dev.sh clean           # Detener y ELIMINAR volúmenes (DESTRUCTIVO)
./dev.sh lint            # Ejecutar linters (ruff + tsc)
```

### Arquitectura de Desarrollo

- **Hot-reload**: Tanto API (uvicorn --reload) como Web (next dev) tienen hot-reload
- **Volúmenes**: El código fuente se monta directamente en los contenedores
- **Base de datos**: Datos persisten en el volumen `sismo_pgdata_dev`
- **Network**: Todos los servicios en la red `sismo-dev`

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
```

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

### Archivo `.env` de la API (apps/api/.env)

```bash
# OAuth Google
SISMO_GOOGLE_CLIENT_ID=<client-id>
SISMO_GOOGLE_CLIENT_SECRET=<client-secret>
SISMO_GOOGLE_REDIRECT_URI=https://api.sismo.lat/api/v1/auth/callback

# Session
SISMO_SESSION_SECRET=<mismo-que-en-infra>

# OpenAI (opcional)
SISMO_OPENAI_API_KEY=<api-key>

# Redis
SISMO_REDIS_URL=redis://redis:6379/0
```

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

| Servicio | Puerto | Memoria | Notas |
|---|---|---|---|
| PostgreSQL | 5432 (interno) | 512MB | Datos en volumen `sismo_pgdata` |
| API (FastAPI) | 8000 (interno) | 1GB | 4 workers, healthcheck en `/api/v1/health` |
| Web (Next.js) | 3000 (interno) | 1GB | Standalone mode, non-root user |
| Redis | 6379 (interno) | 128MB | Rate-limiting y cache |
| Cloudflared | - | 128MB | Tunnel a Cloudflare |

### Red de Producción

- **Red**: `sismo-internal` (bridge)
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
| `SISMO_GOOGLE_CLIENT_ID` | Sí | - | Google OAuth Client ID |
| `SISMO_GOOGLE_CLIENT_SECRET` | Sí | - | Google OAuth Client Secret |
| `SISMO_GOOGLE_REDIRECT_URI` | No | `http://localhost:8000/api/v1/auth/callback` | URI de callback OAuth |
| `SISMO_API_CORS_ORIGINS` | No | `http://localhost:3000` | Orígenes CORS (CSV) |
| `SISMO_WEB_ORIGIN` | No | - | Origen del frontend |
| `SISMO_REDIS_URL` | No | `redis://localhost:6379/0` | URL de Redis |
| `SISMO_OPENAI_API_KEY` | No | - | API Key de OpenAI (para IA) |
| `SISMO_OPENAI_MODEL` | No | `north-mini-code-free` | Modelo de OpenAI |
| `SISMO_LOG_LEVEL` | No | `INFO` | Nivel de log |
| `SISMO_ENV` | No | `local` | Entorno (local/dev/staging/prod) |

\* Requerido en producción (la app falla al iniciar si no está seteado con `NODE_ENV=production`)

### Web (Next.js)

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Sí | URL pública de la API (ej: `https://api.sismo.lat`) |
| `NEXT_PUBLIC_WEB_ORIGIN` | Sí | Origen del frontend (ej: `https://sismo.lat`) |
| `SISMO_SESSION_SECRET` | Sí* | Mismo secret que la API (para verificar cookies) |
| `INTERNAL_API_URL` | No | URL interna de la API (Docker networking, ej: `http://api:8000`) |

---

## Seguridad

### Autenticación

- **OAuth 2.0** con Google como proveedor de identidad
- **Sesiones** firmadas con HMAC (`sismo_session` cookie, HttpOnly, Secure, SameSite=None en prod)
- **CSRF** protección con double-submit cookie pattern (`XSRF-TOKEN`)
- **Rate limiting** por IP: 60 req/min (público), 30 req/min (auth)

### Protección de Rutas

Las páginas protegidas (`/perfil`, `/mis-actividades`, `/voluntarios/crear`, `/voluntarios/[id]/admin`) validan sesión en el **servidor** usando `requireSession()` antes de renderizar.

### Endpoints Protegidos (requieren sesión válida)

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/invite`
- `POST /api/v1/auth/logout`
- `GET /api/v1/activities/mine`
- `POST /api/v1/activities` (crear)
- `PATCH /api/v1/activities/{id}`
- `DELETE /api/v1/activities/{id}`
- `POST /api/v1/activities/{id}/join`
- `POST /api/v1/activities/{id}/leave`
- `POST /api/v1/ai/suggest`
- `POST /api/v1/ai/suggest/stream`

### Endpoints Públicos (no requieren sesión)

- `GET /api/v1/health`
- `GET /api/v1/activities` (listar)
- `GET /api/v1/activities/{id}` (detalle)
- `GET /api/v1/activities/zones`
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
GET    /api/v1/activities/{id}      → Detalle de actividad (público)
GET    /api/v1/activities/zones     → Zonas disponibles
GET    /api/v1/activities/mine      → Mis actividades (sesión)
POST   /api/v1/activities           → Crear actividad (sesión)
DELETE /api/v1/activities/{id}      → Cancelar/archivar (sesión)
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
