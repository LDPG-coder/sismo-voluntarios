# Validación de actividades externas

Flujo para validar **actividades externas** (realizadas fuera de la plataforma):
el becario completa la evidencia (fotos, descripción, horas, ubicación,
institución y datos relevantes), la envía a revisión, y un administrador la
valida o la rechaza. Se registra la fecha de validación y el responsable, y el
administrador puede exportar los datos a Excel junto con las carpetas de
adjuntos.

- Commit de la funcionalidad: `d71da50`

## Modelo de datos

### Estados (`apps/api/app/db/enums.py`)

Se agregan dos estados a `ActivityStatus`:

- `pending_validation` — enviada por el becario, en revisión.
- `validated` — validada por un administrador.

### Campos (`apps/api/app/db/models/activities.py`)

- `external_relevant_data` (`Text`) — datos relevantes que aporta el becario.
- `validated_at` (`DateTime` con zona) — fecha/hora de la validación.
- `validated_by` (`UUID`, FK `users.id`, indexado) — administrador responsable.
- `validated_by_user` — relación con el usuario responsable.
- `validation_notes` (`Text`) — notas de la revisión (validar o rechazar).

Migración: `apps/api/alembic/versions/018_activity_validation.py`
(`down_revision = 017_media_assets`).

## API (`apps/api/app/api/v1/activities.py`)

### Becario (creador)

- `POST /{activity_id}/submit-validation` — envía la actividad a revisión.
  Requiere que sea externa y esté `active`, con `external_relevant_data`, horas
  y al menos una evidencia; pasa a `pending_validation`. Error de validación:
  `422 validation_invalid`.

### Administrador (`require_admin_session`)

- `POST /{activity_id}/validate` — valida; registra `validated_at`,
  `validated_by` y `validation_notes`; pasa a `validated`.
- `POST /{activity_id}/reject-validation` — rechaza con notas; vuelve a
  `active` para que el becario corrija y reenvíe.
- `GET /admin/external-validation` — lista actividades externas por estado
  (por defecto las `pending_validation`).
- `GET /admin/export-external?status=all` — descarga un ZIP con:
  - `actividades_externas.xlsx` (una fila por actividad; columna
    **"Ruta adjuntos"** = `adjuntos/{id}/`).
  - `adjuntos/{id}/evidencia/...` — evidencias.
  - `adjuntos/{id}/constancia/constancia.pdf` — constancia oficial.

Los cambios de estado notifican al becario/administrador vía
`_notify_validation_change`.

### Errores (`apps/api/app/core/errors.py`)

- `validation_invalid` → HTTP 422.

### Dependencias (`apps/api/requirements.txt`)

- `openpyxl>=3.1.0` (generación del Excel de exportación).

## Frontend (`apps/web`)

- `components/activity-validation-client.tsx` (nuevo): panel de envío (creador,
  estado `active`) y de revisión (admin, estado `pending_validation`) con
  validar/rechazar y notas; muestra `validated_at`, `validated_by_name` y
  `validation_notes`.
- `components/activity-status-badges.tsx`: badges `pending_validation`
  ("En revisión") y `validated` ("Validada").
- `app/(app)/voluntarios/[id]/page.tsx`: integra el panel, muestra los datos
  relevantes y la constancia en los estados correspondientes.
- `components/crear-activity-client.tsx` y `editar-activity-client.tsx`: campo
  de datos relevantes en la sección de actividad externa.
- `components/admin-usuarios-client.tsx`: botón de exportación
  (`GET /api/v1/activities/admin/export-external?status=all`).
- `lib/types.ts`: `Activity` extendido con `external_relevant_data`,
  `validated_at`, `validated_by`, `validated_by_name` y `validation_notes`.

## Validación

- `tests/test_activity_validation.py`: 7 pruebas (envío requiere datos
  relevantes/horas/evidencia; flujo completo; el rechazo vuelve a `active`;
  listado admin; exportación ZIP). Todas pasan.
- Ejecución en contenedor efímero:

  ```
  COMPOSE_PROJECT_NAME=sismo-dev docker compose \
    -f infra/docker-compose.dev.yml --profile test run --rm --build test-api \
    sh -c "python -m pytest tests/test_activity_validation.py -q"
  ```
