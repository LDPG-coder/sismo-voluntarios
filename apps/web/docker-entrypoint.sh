#!/bin/sh
# Entrypoint que inyecta los Docker secrets (montados en /run/secrets)
# como variables de entorno antes de arrancar el proceso.
set -e

if [ -d /run/secrets ]; then
  for f in /run/secrets/*; do
    [ -e "$f" ] || continue
    key="$(basename "$f")"
    val="$(cat "$f")"
    export "$key=$val"
  done
fi

exec "$@"
