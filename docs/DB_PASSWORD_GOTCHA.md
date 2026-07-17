# Gotcha recurrente: contraseña de la BD y "deploy" (NO volver a enredarse)

Este es el problema que **varias veces** rompe el sitio tras un "deploy" o tras
tocar contenedores: la API no puede conectar a PostgreSQL y **todo** falla (login,
feed, etc.) con errores del tipo `psycopg.OperationalError: password authentication
failed for user "sismo"`.

## Cómo funciona la contraseña (fuente de la confusión)

- `infra/.env` define `SISMO_DB_PASSWORD=njiB0vws*9DCIUnCVCpCbKDHj40#yqxn`.
- **La API NO recibe la contraseña como env var.** Se pasa como Docker secret:
  `infra/secrets/sismo_db_password` (montado en `/run/secrets/...` y exportado a
  env por `docker-entrypoint.sh`). Por eso `docker exec infra-api-1 printenv` **no**
  muestra `SISMO_DB_PASSWORD` — pero la API SÍ la usa en runtime. El fallback de
  `config.py` (`db_password = "sismo"`) solo aplica si el secret no está montado.
- **Postgres** recibe la contraseña vía `POSTGRES_PASSWORD` (override
  `docker-compose.override.yml`, volumen `sismo_pgdata`, red `sismo`).
- Ambos deben coincidir con el valor de `infra/.env`. El `#` del password se
  conserva bien: `setup-secrets.sh` usa `cut -d= -f2-` (no corta en `#`) y Docker
  Compose no lo trata como comentario porque no va tras espacio. El archivo
  `infra/secrets/sismo_db_password` debe tener **32 bytes** y contener `#`.
- El login de Google también depende de la BD (el endpoint `/auth/login` escribe
  el `state` OAuth en la BD). Por eso "el botón de Google no hace nada" era en
  realidad este fallo de conexión a la BD, no un problema del frontend.

## Dos trampas que repiten el bug (NO hacerlas)

1. **NUNCA** `ALTER ROLE sismo WITH PASSWORD 'sismo'` como "arreglo". El API
   envía el secret real, no `'sismo'`. Ese ALTER deja el rol con una contraseña
   que no coincide y rompe la conexión. (Costó varias vueltas.)
2. **NUNCA** recrear postgres con `docker compose -f infra/docker-compose.dev.yml
   up -d postgres redis`. Ese compose usa el volumen `sismo_pgdata_dev` y la red
   `sismo-dev`; deja `infra-postgres-1` fuera de la red `sismo` (el API no resuelve
   el host `postgres`) y puede resetear el rol. Para levantar postgres en prod usa
   el override estándar (`docker-compose.override.yml` → volumen `sismo_pgdata`,
   red `sismo`).

## Receta de diagnóstico y fix (copiable)

```bash
cd infra
# 1) Verificar que el archivo secret tiene los 32 bytes y el '#'
wc -c secrets/sismo_db_password          # debe ser 32
grep -c '#' secrets/sismo_db_password    # debe ser 1

# 2) Poner el rol sismo EXACTAMENTE al valor del secret (dura aunque se recree
#    postgres, porque POSTGRES_PASSWORD usa el mismo valor de .env).
PW=$(cat secrets/sismo_db_password)
docker exec -e PGPASSWORD="$PW" infra-postgres-1 \
  psql -U sismo -h 127.0.0.1 -d sismo \
  -c "ALTER ROLE sismo WITH PASSWORD '$PW';"

# 3) Verificar el camino REAL (red del bridge, donde pg_hba exige password):
docker run --rm --network sismo postgres:16-alpine \
  psql "postgresql://sismo:$PW@postgres:5432/sismo" -tAc "SELECT 'NETWORK-AUTH-OK';"
#    (El 127.0.0.1 desde dentro del container usa trust y NO prueba la password;
#     por eso un psql local "funciona" aunque la red falle. Siempre probar con
#     el container efímero en la red `sismo`.)

# 4) Reiniciar la API para que el pool reconecte y comprobar:
docker restart infra-api-1
curl -s -o /dev/null -w "%{http_code}\n" https://api.sismo.lat/api/v1/activities   # 401 = BD ok
curl -s -i https://api.sismo.lat/api/v1/auth/login | grep -i '^location'            # -> accounts.google.com
```

## Checklist antes de decir "deploy listo"

- [ ] `curl https://api.sismo.lat/api/v1/activities` → `401` (no `500`).
- [ ] `curl -i https://api.sismo.lat/api/v1/auth/login` → `302` a `accounts.google.com...`
- [ ] `docker logs infra-api-1 --tail 50 | grep -i "password authentication failed"` → vacío.
- [ ] `infra-postgres-1` en la red `sismo` con alias `postgres`
      (`docker network inspect sismo` lo lista).
