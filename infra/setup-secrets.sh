#!/usr/bin/env bash
# Genera los archivos de Docker secrets a partir de infra/.env.
# Los secretos NO se inyectan como environment, sino como archivos
# montados en /run/secrets (ver docker-compose.yml + docker-entrypoint.sh).
#
# Uso:  ./setup-secrets.sh
set -euo pipefail

cd "$(dirname "$0")"

mkdir -p secrets

get_env() {
  # Extrae el valor de una var de infra/.env (tolera = y caracteres especiales)
  grep -E "^${1}=" .env | head -1 | cut -d= -f2-
}

write_secret() {
  local filename="$1" envvar="$2"
  local val
  val="$(get_env "$envvar")"
  if [ -z "$val" ]; then
    echo "WARN: $envvar no está definido en .env -> no se crea secrets/$filename"
    return
  fi
  # Sin newline final para no romper passwords/keys.
  # 0644: Compose monta el archivo conservando estos permisos, y el
  # container corre como usuario no-root, así que debe poder leerlo.
  printf '%s' "$val" > "secrets/$filename"
  chmod 644 "secrets/$filename"
  echo "OK  secrets/$filename"
}

write_secret sismo_db_password        SISMO_DB_PASSWORD
write_secret sismo_session_secret     SISMO_SESSION_SECRET
write_secret sismo_google_client_secret SISMO_GOOGLE_CLIENT_SECRET
write_secret supabase_key             SUPABASE_KEY

echo ""
echo "Secretos generados en infra/secrets/ (gitignored, no commitear)."
