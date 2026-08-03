#!/bin/sh
# ============================================================
# Sismo Voluntarios — Restore (Supabase Storage → Postgres)
# ============================================================
# Ejecutar dentro del container backup:
#   docker compose -f docker-compose.yml -f docker-compose.backup.yml \
#     run --rm backup ./scripts/restore.sh --dry-run
#   docker compose -f docker-compose.yml -f docker-compose.backup.yml \
#     run --rm backup ./scripts/restore.sh
#
# En el compose raíz del proyecto SEP 2.0 (scripts montados en /scripts/):
#   docker compose exec backup sh /scripts/restore.sh --dry-run
#   docker compose exec backup sh /scripts/restore.sh
#
# IMPORTANTE: restaurar SOBREESCRIBE la base actual (--clean --if-exists).
#   Ejecutar SOLO en emergencia. El último dump LOCAL puede estar más
#   fresco que el remoto: el backup remoto se sube cada 6h.
#
# Variables (env o Docker secrets):
#   SISMO_DB_HOST, SISMO_DB_PORT, SISMO_DB_NAME, SISMO_DB_USER
#   SISMO_DB_PASSWORD (via /run/secrets/sismo_db_password)
#   SUPABASE_URL, SUPABASE_KEY (via /run/secrets/supabase_*)
#   BACKUP_DIR (default: /backups)
#   BUCKET (default: sismo-backups)
#   DRY_RUN (default: 0) — o flag --dry-run
# ============================================================
set -eu

DB_HOST="${SISMO_DB_HOST:-postgres}"
DB_PORT="${SISMO_DB_PORT:-5432}"
DB_NAME="${SISMO_DB_NAME:-sismo}"
DB_USER="${SISMO_DB_USER:-sismo}"
DB_PASSWORD="${SISMO_DB_PASSWORD:-}"
# Si el password viene como Docker secret (archivo), leerlo
[ -z "$DB_PASSWORD" ] && [ -f /run/secrets/SISMO_DB_PASSWORD ] && DB_PASSWORD="$(cat /run/secrets/SISMO_DB_PASSWORD)"
[ -z "$DB_PASSWORD" ] && [ -f /run/secrets/sismo_db_password ] && DB_PASSWORD="$(cat /run/secrets/sismo_db_password)"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BUCKET="${BUCKET:-sismo-backups}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_KEY:-}"
# Supabase creds via Docker secrets (si no llegan por env)
[ -z "$SUPABASE_URL" ] && [ -f /run/secrets/supabase_url ] && SUPABASE_URL="$(cat /run/secrets/supabase_url)"
[ -z "$SUPABASE_KEY" ] && [ -f /run/secrets/supabase_key ] && SUPABASE_KEY="$(cat /run/secrets/supabase_key)"
export PGPASSWORD="$DB_PASSWORD"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

die() { log "ERROR: $*"; exit 1; }

# Normaliza el flag --dry-run a DRY_RUN=1
DRY_RUN="${DRY_RUN:-0}"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) log "WARN: argumento desconocido ignorado: $arg" ;;
  esac
done

# --- Configuración obligatoria (a diferencia de backup.sh, aquí NO se omite) ---
[ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ] || die "Falta config de Supabase: SUPABASE_URL y/o SUPABASE_KEY vacíos. Seteá el .env raíz o los secrets /run/secrets/supabase_*."
[ -n "$DB_PASSWORD" ] || die "Falta SISMO_DB_PASSWORD (env o secret /run/secrets/sismo_db_password)"

mkdir -p "$BACKUP_DIR"
log "=== Restore start: $(date -u +%Y-%m-%d_%H%M%S) ==="

# 1. Seleccionar el dump más reciente en Supabase (db/sismo_YYYYMMDD_HHMMSS.dump,
#    el orden alfabético == orden cronológico)
log "1/4 Listando dumps en Supabase ($BUCKET/db/)..."
ALL_DUMPS=$(curl -sS --max-time 30 \
  -X POST \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"db/","limit":200,"offset":0,"sortBy":{"column":"name","order":"asc"}}' \
  "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" 2>/dev/null \
  | jq -r '.[].name' 2>/dev/null \
  | grep '^sismo_.*\.dump$' || true)

[ -n "$ALL_DUMPS" ] || die "No se encontraron dumps (db/sismo_*.dump) en el bucket ${BUCKET}"

DB_DUMP=$(echo "$ALL_DUMPS" | sort | tail -n 1)
log "   seleccionado: $DB_DUMP (último dump remoto)"

# 2. Descargar
REMOTE_PATH="db/$DB_DUMP"
log "2/4 Descargando $REMOTE_PATH → $BACKUP_DIR/$DB_DUMP"
curl -sS --fail --max-time 120 \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -o "$BACKUP_DIR/$DB_DUMP" \
  "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${REMOTE_PATH}"
log "   done ($(du -h "$BACKUP_DIR/$DB_DUMP" | cut -f1))"

# 3. Verificar integridad: debe ser un dump custom válido
log "3/4 Verificando integridad del dump..."
if pg_restore --list "$BACKUP_DIR/$DB_DUMP" >/dev/null 2>&1; then
  log "   OK: dump custom válido"
else
  die "El archivo descargado no es un dump pg_dump custom válido: $DB_DUMP"
fi

# 4. Restaurar (salvo dry-run)
if [ "$DRY_RUN" = "1" ]; then
  log "4/4 [DRY RUN] No se restauró nada."
  log "   Haría: pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --clean --if-exists --no-owner --no-privileges $BACKUP_DIR/$DB_DUMP"
  log "=== Restore (dry-run) complete ==="
  exit 0
fi

# --no-owner --no-privileges evita errores cuando el rol local ($DB_USER)
# no es el dueño de los objetos del dump.
log "4/4 Restaurando $DB_DUMP en $DB_HOST:$DB_PORT/$DB_NAME..."
if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner --no-privileges "$BACKUP_DIR/$DB_DUMP"; then
  log "=== Restore complete ==="
else
  code=$?
  log "WARN: pg_restore terminó con código $code (revisar warnings arriba; con --no-owner suelen ser inofensivos)"
  exit "$code"
fi
