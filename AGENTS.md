## Objective
- Login con Google funcione end-to-end; mantener prod estable. Corregir flujo "ceder cupo", visibilidad de inscritos y tour inicial; tests permanentes.

## Important Details
- App: FastAPI (`apps/api`) + Next.js 15 (`apps/web`), Postgres + Redis.
- Auth cookie `sismo_session` = `base64url(json).hmac_sha256(secret, encoded)`, payload `{user_id,role,status,iat,exp,jti}`; secret = `SISMO_SESSION_SECRET` (Docker secret `infra/secrets/sismo_session_secret`, 64 chars). CSRF: cookie `XSRF-TOKEN` + header `X-CSRF-Token`.
- **Contraseña de BD (CRÍTICO — ver `docs/DB_PASSWORD_GOTCHA.md`):**
  - `SISMO_DB_PASSWORD=njiB0vws*9DCIUnCVCpCbKDHj40#yqxn` (en `infra/.env`; el `#` se conserva bien).
  - La API NO recibe la pw como env var: viene de Docker secret `infra/secrets/sismo_db_password` (montado en `/run/secrets/...`, exportado a env por `docker-entrypoint.sh`). `docker exec printenv` NO la muestra, pero la API la usa en runtime. El fallback `config.py` (`db_password="sismo"`) solo aplica si el secret no está montado.
  - Postgres rol `sismo` password DEBE coincidir exactamente con el valor del secret (también = `POSTGRES_PASSWORD`). Hoy: `ALTER ROLE sismo WITH PASSWORD '<valor de secrets/sismo_db_password>'` aplicado → red bridge auth OK.
  - **TRAMPAS (no repetir):** (1) NUNCA `ALTER ROLE sismo WITH PASSWORD 'sismo'` como fix — la API envía el secret real, no `'sismo'`, así que eso rompe la conexión. (2) NUNCA recrear postgres con `docker-compose.dev.yml` (usa volumen `sismo_pgdata_dev` + red `sismo-dev`, saca `infra-postgres-1` de la red `sismo`). Usar override estándar (`sismo_pgdata` + red `sismo`).
  - Diagnóstico: `PW=$(cat infra/secrets/sismo_db_password); docker run --rm --network sismo postgres:16-alpine psql "postgresql://sismo:$PW@postgres:5432/sismo" -tAc "SELECT 1"` (el 127.0.0.1 dentro del container usa trust y NO prueba la pw; siempre probar sobre la red `sismo`).
- Dev admin fijo: `DEV_ADMIN_ID = 11111111-1111-1111-1111-111111111111`.
- Red `sismo`: `infra-api-1`, `infra-web-1` (alias `web` — ÚNICO), `infra-postgres-1` (alias `postgres`), `infra-redis-1` (alias `redis`), `infra-cloudflared-1`. `infra-postgres-1` DEBE estar en red `sismo` con alias `postgres`. **CRÍTICO: el alias `web` debe pertenecer a UN SOLO container** (`infra-web-1`). Nunca levantar un segundo web (p.ej. `sismo-public-web-1`) en la misma red `sismo` con el mismo alias — causa DNS ambiguo y la web muestra "dos páginas" / tour aleatorio.
- Web routes: `/voluntarios`, `/voluntarios/crear`, `/mis-actividades`, `/admin`, `/login`, `/auth/finish`, `/voluntarios/[id]`, `/voluntarios/[id]/admin`, `/voluntarios/[id]/editar`, `/perfil`. Login button = `<a href="{NEXT_PUBLIC_API_URL}/api/v1/auth/login">` → debe 302 a `accounts.google.com`.
- **Regla usuario sobre dev-web en prod**: solo para testear; luego limpiar, NO dejar levantada. `sismo-dev-web-1` ya eliminado. `sismo-dev-api-1` (dev, contra `sismo_test`) también eliminado (2026-07-17) — solo queda prod activa.
- Test runner aislado: `docker compose -f infra/docker-compose.dev.yml run --rm test-api` (BD `sismo_test`). **Caveat**: fixture `truncate` (`apps/api/tests/conftest.py:53`) no limpia `users` (ciclos FK); hay que dropear `sismo_test` entre archivos. `openpyxl` requerido.
- Tour: auto-arranca SOLO en `/voluntarios` para no-admin (gate `localStorage["sismo_onboarding_done"]` + `usePathname() === "/voluntarios"` en `onboarding-tour.tsx`). El botón "?" manual también solo en `/voluntarios`. Forzar con `?tour=1` (cualquier ruta).

## Work State
- Completed:
  - **Fix login Google (2026-07-17):** Causa raíz = `infra-postgres-1` rol `sismo` tenía password `sismo` (de un `ALTER ROLE` previo mío) mientras la API enviaba el secret real → `password authentication failed`. El endpoint `/auth/login` escribe el `state` OAuth en BD, así que fallaba y redirigía a `/login?error=oauth_error` ("el botón no hace nada"). Arreglado: `ALTER ROLE sismo WITH PASSWORD '<secret>'`. Ahora `/api/v1/auth/login` → 302 a `accounts.google.com...`, `/activities` → 401 (BD ok). Documentado en `docs/DB_PASSWORD_GOTCHA.md`.
  - Restore BD live (301 usuarios, 27 actividades, 34 inscripciones). Migraciones `022` + `023_add_ceded_by` aplicadas a prod.
  - Fix Google OAuth (redirect a error en vez de 500) + autocompletado IA (commit `ce28476`) + tests Playwright/API previos PASS.
  - Bug A: `_enrolled_activity_ids_subquery` (`activities.py:150`) excluye `status.in_(["active","ceded"])`.
  - Bug B2: `list_attendees` (`activities.py:1070`) ya NO da 403; cualquier autenticado ve nombre+foto; email solo creador/SEP/admin.
  - Flujo aceptación: `transfer_membership` (`activities.py:996`) crea `pending_transfer` (con `ceded_by`); sender→`ceded`. Endpoints `POST /activities/{id}/transfer/accept` (pending→active + notifica `activity_transfer_accepted`) y `POST /activities/{id}/transfer/reject` (borra pending, restaura sender). `check_membership` (`activities.py:697`) devuelve `{is_member,status}`. `join_activity` (`activities.py:927`) bloquea rejoin si `ceded` (409).
  - `GET /activities/ceded` (`ceded_activities`).
  - Frontend: `voluntarios/[id]/page.tsx` banner `pending_transfer` + aceptar/rechazar; `mis-actividades-client.tsx` tab "Cedidos"; `header-bar.tsx` `data-tour="header-notif"`; `onboarding/steps.ts` 5 secciones; `onboarding-tour.tsx` `?tour=1`.
  - Tests: `test_ceder_cupo.py` 9/9, `test_activity_visibility.py` 15/15, `test_qa_walkthrough.py` 30/30.
  - Limpieza: `sismo-dev-web-1` eliminado, artifactos test limpiados, `infra/docker-compose.test.yml` removido, `sismotest` down.
  - **Fix "dos páginas" / tour aleatorio (2026-07-17):** Causa raíz = DOS containers web con el MISMO alias `web` en red `sismo`: `infra-web-1` (prod, build reciente) y `sismo-public-web-1` (duplicado manual mio, 24h). Cloudflare resolvía `web` ambiguo → misma URL mostraba 2 páginas y el tour saltaba al azar. Eliminado `sismo-public-web-1`; `infra-web-1` es el ÚNICO web (alias `web`). `web` ahora resuelve a un solo container.
  - **Bug 1 (cedido + "Unirme"):** feed `voluntarios/page.tsx` trae `/activities/ceded` → `cededIds`; `activity-card.tsx`, `activity-detail-modal.tsx` y `join-button.tsx` muestran "Cupo cedido" (no "Unirme") cuando `status === "ceded"`.
  - **Bug 2 (tour en crear/mis-actividades):** `onboarding-tour.tsx` usa `usePathname()` y solo auto-arranca en `/voluntarios`; botón "?" también solo ahí.
  - **Bug 3 (unificar /mis-actividades):** mantenida la página de 3 secciones (Creadas/Inscritas/Cedidos); eliminada ruta huérfana `mis-actividades/todas` + `todas-actividades-client.tsx`; quitado tope de 5 y links "Ver todas" → la página 3-secciones muestra TODO (cumple lo que la otra hacía + tab Cedidos extra).
  - **Deploy prod:** `infra-web-1` rebuild con `--no-cache` (infra-web:latest) y recreate (`docker compose -f docker-compose.yml up -d --force-recreate --no-deps web`). Verificado en bundle: "Cupo cedido" presente, tour gated a `/voluntarios`, tab "Cedidos" presente, sin rastro de `/mis-actividades/todas`. Sitio: `sismo.lat` 200, `/mis-actividades` 307→login (protegido OK), `/api/v1/auth/login` 302 Google.
- Active: (none)
- Blocked: (none)

## Next Move
1. Login Google restaurado (redirect a Google OK). Round-trip completo depende de que el `redirect_uri` `https://api.sismo.lat/api/v1/auth/callback` esté autorizado en Google Cloud Console (config externa; el cliente OAuth en env parece legítimo). Si el usuario reporta error post-Google, revisar `docker logs infra-api-1 | grep oauth.callback`.
2. (none más) — flujo ceder/tour entregado; verificación en vivo del usuario.
