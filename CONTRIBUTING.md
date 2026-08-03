# Guía de contribución

¡Gracias por tu interés en contribuir a Sismo Voluntarios! Esta guía explica cómo trabajar en el repo, qué cambios se aceptan y —muy importante— cómo operar de forma segura sobre la base de datos.

## Qué es Sismo Voluntarios

Monorepo dentro del proyecto **SEP 2.0** (`/Users/Porto/Desktop/SEP 2.0/`), que gestiona el programa de voluntarios y becarios de sismo.lat.

- `apps/web` — frontend en Next.js 15 (admin y vistas públicas de voluntarios).
- `apps/api` — backend en FastAPI (Python), expone la API en `:8000`.
- `apps/` comparten una base **Postgres** (`container pg-sep-sismo`) y **Redis** (cache/sesiones).
- `infra/` — scripts de backup/restore, composes auxiliares y secrets (gitignored).

## Flujo de trabajo

Este repo (`LDPG-coder/sismo-voluntarios`) ya es el fork del equipo. **No hace falta forkear de nuevo.**

1. Trabajá sobre la rama `main` de `LDPG-coder/sismo-voluntarios`.
2. Commits convencionales **en inglés** (`feat:`, `fix:`, `chore:`, `docs:`, ...).
3. Push directo a `origin/main` (así se viene trabajando; no se usan PRs salvo que cambie la regla).
4. Mantené cada commit acotado a una tarea: no mezclar cambios no relacionados.

## Cambios de base de datos (MUY importante)

La BD es compartida y de producción. Los cambios de datos, sobre todo los que **borran o modifican usuarios**, requieren cuidado extremo.

### Verificá dependencias ANTES de borrar

Antes de eliminar o modificar datos de usuarios, revisá las claves foráneas hacia `users` (todas `NO ACTION` — la BD NO borra en cascada, cualquier resto rompe el borrado):

- `activities.creator_id`
- `activity_evidence.uploaded_by`
- `media_assets.created_by`
- `notifications.user_id`
- `users.photo_asset_id` (self-FK)
- `users.referred_by` (self-FK)

### Hacé SIEMPRE backup ANTES de borrar

Antes de tocar datos, volcá la tabla o las filas afectadas y subí el backup a Supabase:

```bash
docker exec pg-sep-sismo pg_dump -U sep -d sismo -t users --data-only --inserts > backup.sql
```

Luego subilo al bucket `sismo-backups`, carpeta `users/` (usá el helper `sb_upload` de `infra/scripts/backup.sh` o curl directo a Supabase Storage). Un backup local en `infra/backups/` NO alcanza: el remoto es el que queda disponible si se pierde el entorno.

### Orden seguro de borrado (transacción única)

Para borrar usuarios sin dejar huérfanos, respetá este orden dentro de una sola transacción:

1. Desvincular `users.photo_asset_id` (NULL o apuntar a otra foto).
2. Reasignar `activities.creator_id` y `activity_evidence.uploaded_by` al admin.
3. Poner `media_assets.created_by = NULL` (o reasignar).
4. Borrar la media `user_photo` huérfana.
5. Borrar `notifications` del usuario.
6. Recién ahí borrar de `users`.

### Recordatorio crítico sobre `docker exec`

`docker exec` **sin `-i`** no pasa stdin al container: un heredoc de psql ejecutado así no hace NADA en silencio. Usá siempre `docker exec -i`.

```bash
# ✓ Correcto
docker exec -i pg-sep-sismo psql -U sep -d sismo <<'SQL'
DELETE FROM notifications WHERE user_id = '...';
SQL

# ✗ Incorrecto (no pasa stdin → no ejecuta)
docker exec pg-sep-sismo psql -U sep -d sismo <<'SQL'
...
SQL
```

### Nunca borres volúmenes de datos

`pgdata` (datos Postgres), `sismo_media` y `sismo_proxy_cache` son persistentes y contienen datos de producción. **NO se borran ni se recrean** por placer: eso destruye la BD y los archivos de media.

## Backups y restore

- Para operar backups (pg_dump + media + Supabase) o restaurar, seguí **`docs/PROD_RUNBOOK.md`**.
- Restaurar **SOBREESCRIBE** la base actual: solo en emergencia, y verifica con `--dry-run` primero.

## Entorno local

- Todo corre con el **docker compose raíz** de SEP 2.0 (`docker compose up -d`). No hace falta instalar Node ni Python en el host.
- El `.env` **raíz** (`/Users/Porto/Desktop/SEP 2.0/.env`) tiene las credenciales (Supabase, Google, Postgres).
- Los secrets (contraseña de BD, session secret, Google, Supabase key) viven en `secrets/` del proyecto SEP 2.0 (`/Users/Porto/Desktop/SEP 2.0/secrets/`) — **gitignored**, nunca se commitean.

## Qué se acepta y qué no

**Se acepta con probabilidad:**
- Correcciones de errores pequeñas y bien delimitadas.
- Mejoras puntuales de estabilidad, confiabilidad o rendimiento.
- Mantenimiento acotado y mejoras de documentación alineadas al proyecto.

**Es menos probable que se acepte:**
- Cambios grandes o difíciles de revisar.
- Reescrituras amplias o cambios de arquitectura no solicitados.
- Cambios que mezclen varias tareas no relacionadas.
- Funcionalidades que amplíen el alcance sin discusión previa.

## Código y formato

- Seguí el estilo existente del proyecto (API en FastAPI, web en Next.js 15).
- Nombres claros, sin cambios de formato no relacionados con la tarea.
- Actualizá la documentación necesaria (`docs/`, runbook, esta guía) cuando tu cambio afecte cómo se opera el sistema.
