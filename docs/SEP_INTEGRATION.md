# Integración SISMO ⇄ SEP

## Decisión

SISMO se integrará en SEP como **proxy reverso**: SISMO se sirve en una ruta
del dominio de SEP (`https://sep.org/voluntarios/`). El Micro-frontend (Module
Federation) se descartó porque no es compatible con el App Router de Next 15.

## Lo funcional hoy (implementado en SISMO)

- **Partner API** (`apps/api/app/api/v1/partner.py`): SISMO expone
  `GET /partner/v1/users/{sep_user_id}/notifications/summary` y
  `GET /partner/v1/users/{sep_user_id}/notifications`, autenticadas con
  `Bearer <SISMO_SEP_API_TOKEN>`. SEP la usa para mostrar las notificaciones de
  SISMO en su header. Implementada y con tests. Contrato en
  `docs/SEP_INTEGRATION_COOKBOOK.md`.
- **Flujo de identidad SEP (ya existente):** `POST /api/v1/auth/sep-login`
  (server-to-server, `Bearer <SISMO_SEP_API_TOKEN>` → one-time `code`) y
  `POST /api/v1/auth/exchange` (cookie `sismo_session`). Reutilizable para que
  un usuario de SEP entre a SISMO sin re-login.
- SISMO usa **su propia BD** (postgres, separada en la instancia de SEP).

## Pendiente (no aplicado)

Aún no se ha implementado/desplegado lo siguiente; no hay código aplicado para
ello:

- Verificación en la API del header firmado HMAC que SEP enviaría con la
  identidad del usuario.
- Configurar el web para la subruta `/voluntarios` (`basePath`) y
  `NEXT_PUBLIC_API_URL` al mismo origen.
- Despliegue de SISMO detrás del reverse proxy de SEP, inyección de identidad
  por parte de SEP, enlace en el sidebar de SEP, campana en el header de SEP, y
  limpieza de `sismo_session` en el logout de SEP.
