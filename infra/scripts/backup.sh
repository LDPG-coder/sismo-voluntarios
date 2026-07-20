#!/bin/sh
# ============================================================
# Sismo Voluntarios — Backup (pg_dump + media + Supabase)
# ============================================================
# Ejecutar dentro del container backup:
#   docker compose -f docker-compose.yml -f docker-compose.backup.yml \
#     run --rm backup
#
# Variables (env o Docker secrets):
#   SISMO_DB_HOST, SISMO_DB_PORT, SISMO_DB_NAME, SISMO_DB_USER
#   SISMO_DB_PASSWORD (via /run/secrets/sismo_db_password)
#   SUPABASE_URL, SUPABASE_KEY (via /run/secrets/supabase_*)
#   BACKUP_RETENTION_LOCAL (default: 7)
#   BACKUP_RETENTION_REMOTE (default: 30)
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
MEDIA_DIR="${MEDIA_DIR:-/data/media}"
RETENTION_LOCAL="${BACKUP_RETENTION_LOCAL:-7}"
RETENTION_REMOTE="${BACKUP_RETENTION_REMOTE:-30}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_KEY:-}"
BUCKET="sismo-backups"
TS="$(date -u +%Y%m%d_%H%M%S)"
DB_DUMP="sismo_${TS}.dump"
MEDIA_TAR="sismo_media_${TS}.tar.gz"

export PGPASSWORD="$DB_PASSWORD"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# --- Supabase helpers (curl) ---
sb_upload() {
  local file="$1" path="$2"
  [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ] && return 0
  log "  → Supabase: $path"
  curl -sS --fail --max-time 60 \
    -X POST \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/octet-stream" \
    -H "x-upsert: true" \
    --data-binary "@$file" \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}" >/dev/null 2>&1 \
    || log "  WARN: upload failed for $path"
}

sb_delete_old() {
  local prefix="$1" keep="$2"
  [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ] && return 0
  # List files in prefix, sort, delete oldest beyond keep count
  local files
  files=$(curl -sS --max-time 15 \
    -X POST \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\":\"${prefix}/\",\"limit\":200,\"offset\":0,\"sortBy\":{\"column\":\"name\",\"order\":\"asc\"}}" \
    "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" 2>/dev/null \
    | jq -r '.[].name' 2>/dev/null || true)
  local count
  count=$(echo "$files" | grep -c . || true)
  if [ "$count" -gt "$keep" ]; then
    local to_delete
    to_delete=$(echo "$files" | head -n "$((count - keep))" | while read -r f; do echo "${prefix}/${f}"; done | jq -R . | jq -s .)
    log "  pruning remote $prefix: deleting $((count - keep)) old files"
    curl -sS --fail --max-time 15 \
      -X DELETE \
      -H "Authorization: Bearer $SUPABASE_KEY" \
      -H "Content-Type: application/json" \
      -d "$to_delete" \
      "${SUPABASE_URL}/storage/v1/object/${BUCKET}" >/dev/null 2>&1 || true
  fi
}

# --- Local cleanup ---
cleanup_local() {
  local count
  count=$(find "$BACKUP_DIR" -maxdepth 1 -name "sismo_*.dump" -type f 2>/dev/null | wc -l)
  if [ "$count" -gt "$RETENTION_LOCAL" ]; then
    log "local: $count dumps > $RETENTION_LOCAL, cleaning..."
    find "$BACKUP_DIR" -maxdepth 1 -name "sismo_*.dump" -type f -printf '%f\n' 2>/dev/null \
      | sort | head -n "$((count - RETENTION_LOCAL))" \
      | while read -r f; do
          rm -f "$BACKUP_DIR/$f"
          rm -f "$BACKUP_DIR/media_${f%.dump}.tar.gz"
          log "  removed: $f"
        done
  fi
}

# --- Main ---
mkdir -p "$BACKUP_DIR"
log "=== Backup start: $TS ==="

# 1. pg_dump
log "1/3 pg_dump → $DB_DUMP"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --format=custom --compress=9 --file="$BACKUP_DIR/$DB_DUMP"
log "   done ($(du -h "$BACKUP_DIR/$DB_DUMP" | cut -f1))"

# 2. Media tar
log "2/3 tar media → $MEDIA_TAR"
if [ -d "$MEDIA_DIR" ] && [ "$(ls -A "$MEDIA_DIR" 2>/dev/null)" ]; then
  tar -czf "$BACKUP_DIR/$MEDIA_TAR" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
  log "   done ($(du -h "$BACKUP_DIR/$MEDIA_TAR" | cut -f1))"
else
  log "   skipped (empty)"
  MEDIA_TAR=""
fi

# 3. Supabase upload
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
  log "3/3 uploading to Supabase..."
  sb_upload "$BACKUP_DIR/$DB_DUMP" "db/$DB_DUMP"
  [ -n "$MEDIA_TAR" ] && sb_upload "$BACKUP_DIR/$MEDIA_TAR" "media/$MEDIA_TAR"
  sb_delete_old "db" "$RETENTION_REMOTE"
  [ -n "$MEDIA_TAR" ] && sb_delete_old "media" "$RETENTION_REMOTE"
else
  log "3/3 Supabase not configured, skipping"
fi

# 4. Local retention
cleanup_local

log "=== Backup complete ==="
log "  Local: $BACKUP_DIR/"
ls -lh "$BACKUP_DIR"/sismo_${TS}.* 2>/dev/null | while read -r line; do log "  $line"; done
