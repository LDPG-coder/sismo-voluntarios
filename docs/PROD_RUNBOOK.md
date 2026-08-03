# Sismo Voluntarios — Production Runbook

## Backups

### Local (automático)
- Retención: 7 días
- Ubicación: `sismo_backup_data` volume (`/backups/` dentro del container `backup`)
- Verificar: `docker compose exec backup ls -lh /backups/`

### Remoto (Supabase)
- Retención: 30 días
- Bucket: `sismo-backups`
- Verificar: `SUPABASE_URL` + `SUPABASE_KEY` en el `.env` raíz del proyecto (`/Users/Porto/Desktop/SEP 2.0/.env`)

### Backups puntuales de la tabla users
- `infra/backups/` local tiene dumps ad-hoc de SOLO la tabla `users` (`users_full_20260802.sql`, `users_removed_20260802.sql`), subidos a Supabase en el prefijo `users/` del bucket `sismo-backups`.
- Son un respaldo puntual de la tabla users (para operaciones de borrado/limpieza de usuarios). NO reemplazan el dump completo `db/sismo_*.dump`.

### Restore de backup
**IMPORTANTE:** restaurar SOBREESCRIBE la base actual (`--clean --if-exists`). Correr SOLO en emergencia. El último dump LOCAL puede estar más fresco que el remoto (el remoto se sube cada 6h).

La forma recomendada es el script `infra/scripts/restore.sh` (descarga el dump más reciente desde Supabase y restaura), ejecutado dentro del container `backup`:

```bash
# 1. Ver qué dump va a usar y descargarlo SIN restaurar (dry-run)
docker compose exec backup sh /scripts/restore.sh --dry-run

# 2. Restaurar el dump más reciente desde Supabase (SOBREESCRIBE la BD)
docker compose exec backup sh /scripts/restore.sh
```

Requisitos: el servicio `backup` del compose raíz monta `./sismo-voluntarios/infra/scripts/restore.sh` en `/scripts/restore.sh` y toma `SUPABASE_URL`/`SUPABASE_KEY` del `.env` raíz. Si el service `backup` no está corriendo, levantarlo primero (`docker compose up -d backup`).

### Restore manual (alternativa)
```bash
# 1. Encontrar el dump local más reciente
docker compose exec backup ls -lh /backups/

# 2. Restaurar pg_dump dentro del container backup (el dump está en su volumen /backups)
docker compose exec backup pg_restore -h postgres -U sep -d sismo \
  --clean --if-exists --no-owner --no-privileges /backups/sismo_YYYYMMDD_HHMMSS.dump
```

- `--no-owner --no-privileges` evita errores cuando el rol local (`sep`) no es el dueño de los objetos del dump.
- Alternativa desde el container `pg-sep-sismo` si el dump se copió al host: `docker exec -i pg-sep-sismo pg_restore -U sep -d sismo --clean --if-exists --no-owner --no-privileges < sismo_YYYYMMDD_HHMMSS.dump`.

## Deploy

> Producción se levanta desde el compose RAÍZ (`/Users/Porto/Desktop/SEP 2.0/docker-compose.yml`); los servicios reales son `sismo-api` y `sismo-web` (containers `sismo-api-1`/`sismo-web-1`). La sección infra de abajo es el stack legacy (services `api`/`web`).

### Rebuild completo (API + Web)
```bash
cd infra
docker compose -f docker-compose.yml build --no-cache api web
docker compose -f docker-compose.yml up -d --force-recreate --no-deps api web
```

### Rebuild solo API
```bash
cd infra
docker compose -f docker-compose.yml build --no-cache api
docker compose -f docker-compose.yml up -d --force-recreate --no-deps api
```

### Rebuild solo Web
```bash
cd infra
docker compose -f docker-compose.yml build --no-cache web
docker compose -f docker-compose.yml up -d --force-recreate --no-deps web
```

### Verificar deploy
```bash
curl -s https://api.sismo.lat/api/v1/health
# Debe retornar: {"status":"ok","db":"ok"}

curl -s https://api.sismo.lat/api/v1/activities?limit=1
# Debe retornar JSON con actividades
```

## Demo Activities

### Sembrar demo (una vez)
```bash
cd sismo-voluntarios/apps/api
docker cp scripts/seed_demo_activities.py sismo-api:/app/seed_demo_activities.py
docker exec sismo-api python /app/seed_demo_activities.py --force
```

### Limpiar demo manualmente
```bash
docker exec -e SISMO_DB_PASSWORD="$(cat /Users/Porto/Desktop/SEP 2.0/secrets/sismo_db_password)" \
  sismo-api python /app/seed_demo_activities.py --force --cleanup
```

### TTL de demo
- Default: 1 día (`config.py:127`)
- Las demo activities tienen `is_demo=True` y `demo_until` timestamp
- Cleanup automático cada 6h vía `demo_cleanup.py` en lifespan de la API

## Troubleshooting

### API no responde (502/503)
```bash
docker logs sismo-api --tail 50
docker exec sismo-api curl -s http://localhost:8000/api/v1/health
```

### Login Google falla
1. Verificar `SISMO_GOOGLE_CLIENT_ID` y `SISMO_GOOGLE_CLIENT_SECRET` en el `.env` raíz
2. Verificar redirect URI en Google Cloud Console: `https://api.sismo.lat/api/v1/auth/callback`
3. Verificar cookie `sismo_session` se genera correctamente

### BD: password authentication failed
**Ver `docs/DB_PASSWORD_GOTCHA.md`** — el problema recurrente es que `ALTER ROLE sismo WITH PASSWORD 'sismo'` se ejecutó por accidente.

```bash
# Fix rápido:
PW=$(cat /Users/Porto/Desktop/SEP 2.0/secrets/sismo_db_password)
docker exec -e PGPASSWORD="$PW" pg-sep-sismo \
  psql -U sep -h 127.0.0.1 -d sismo \
  -c "ALTER ROLE sismo WITH PASSWORD '$PW';"
```

### Container huérfano sismo-dev-*
```bash
docker rm sismo-dev-api-1 sismo-dev-web-1 2>/dev/null || true
docker network rm sismo-dev 2>/dev/null || true
```

### Limpiar builder cache (libera disco)
```bash
docker builder prune -f
```

### Verificar volumenes persistentes
```bash
docker volume ls | grep -E 'sismo|pgdata'
# NO borrar: sep_sismo_pgdata, sismo_media, sismo_proxy_cache, sismo_backup_data
```

## Dependencias

### Actualizar API
1. Editar `apps/api/requirements.txt` con versiones exactas (sin `>=`)
2. Rebuild: `docker compose -f docker-compose.yml build --no-cache api`
3. Verificar tests: `docker compose -f docker-compose.yml exec api python -m pytest tests/ -v`

### Actualizar Web
1. Editar `apps/web/package.json` con versiones exactas (sin `^`)
2. Rebuild: `docker compose -f docker-compose.yml build --no-cache web`
3. Verificar build: `docker compose -f docker-compose.yml exec web npm run typecheck`

## Secrets

### Archivos en `secrets/` del proyecto SEP 2.0 (`/Users/Porto/Desktop/SEP 2.0/secrets/`, gitignored)
- `sismo_db_password` — contraseña de Postgres
- `sismo_session_secret` — firma de cookies (64 chars)
- `sismo_google_client_secret` — OAuth Google
- `sismo_sep_login_token`, `sismo_sep_partner_token` — tokens de integración SEP
- Supabase key (`SUPABASE_KEY`) va en el `.env` raíz (no como archivo de secret)

### Regenerar todos
```bash
cd infra
./setup-secrets.sh
```
