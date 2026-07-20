# Sismo Voluntarios — Production Runbook

## Backups

### Local (automático)
- Retención: 7 días
- Ubicación: `sismo_backup_data` volume
- Verificar: `docker exec infra-backup-1 ls -lh /backups/`

### Remoto (Supabase)
- Retención: 30 días
- Bucket: `sismo-backups`
- Verificar: `SUPABASE_URL` + `SUPABASE_KEY` en `infra/.env`

### Restore de backup
```bash
# 1. Encontrar el dump
docker exec infra-backup-1 ls /backups/

# 2. Restaurar pg_dump
docker exec -i infra-postgres-1 pg_restore -U sismo -d sismo --clean --if-exists \
  < /backups/sismo_YYYYMMDD_HHMMSS.dump

# O si no hay pg_restore disponible:
docker exec -i infra-postgres-1 psql -U sismo -d sismo \
  < /backups/sismo_YYYYMMDD_HHMMSS.sql
```

## Deploy

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
cd apps/api
docker cp scripts/seed_demo_activities.py infra-api-1:/app/seed_demo_activities.py
docker exec infra-api-1 python /app/seed_demo_activities.py --force
```

### Limpiar demo manualmente
```bash
docker exec -e SISMO_DB_PASSWORD="$(cat infra/secrets/sismo_db_password)" \
  infra-api-1 python /app/seed_demo_activities.py --force --cleanup
```

### TTL de demo
- Default: 1 día (`config.py:127`)
- Las demo activities tienen `is_demo=True` y `demo_until` timestamp
- Cleanup automático cada 6h vía `demo_cleanup.py` en lifespan de la API

## Troubleshooting

### API no responde (502/503)
```bash
docker logs infra-api-1 --tail 50
docker exec infra-api-1 curl -s http://localhost:8000/api/v1/health
```

### Login Google falla
1. Verificar `SISMO_GOOGLE_CLIENT_ID` y `SISMO_GOOGLE_CLIENT_SECRET` en `infra/.env`
2. Verificar redirect URI en Google Cloud Console: `https://api.sismo.lat/api/v1/auth/callback`
3. Verificar cookie `sismo_session` se genera correctamente

### BD: password authentication failed
**Ver `docs/DB_PASSWORD_GOTCHA.md`** — el problema recurrente es que `ALTER ROLE sismo WITH PASSWORD 'sismo'` se ejecutó por accidente.

```bash
# Fix rápido:
PW=$(cat infra/secrets/sismo_db_password)
docker exec -e PGPASSWORD="$PW" infra-postgres-1 \
  psql -U sismo -h 127.0.0.1 -d sismo \
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
docker volume ls | grep sismo
# NO borrar: sismo_pgdata, sismo_media_data, sismo_proxy_cache_data, sismo_redis_data
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

### Archivos en `infra/secrets/` (gitignored)
- `sismo_db_password` — contraseña de Postgres
- `sismo_session_secret` — firma de cookies (64 chars)
- `sismo_google_client_secret` — OAuth Google
- `supabase_key` — service_role key de Supabase (backups)

### Regenerar todos
```bash
cd infra
./setup-secrets.sh
```
