# Registro de actividades ya realizadas (actividades privadas)

Permite a un becario **registrar una actividad cuya fecha ya pasó**, sin pasar
por el flujo de publicación. Estas actividades quedan como **privadas**: sirven
únicamente para que el becario valide sus **horas externas**.

## Comportamiento

Al crear una actividad (`POST /api/v1/activities`), el backend calcula si la
actividad **ya terminó** en ese momento: se toma la fecha fin (`end_time`) o, en
su defecto, la fecha de inicio (`date_time`). Si esa fecha ya pasó:

- La actividad se crea inmediatamente con `is_private = true` (no entra al flujo
  de publicación).
- El frontend redirige a la vista individual (`/voluntarios/{id}`).
- Allí el becario ve la sección de comprobantes y puede subir fotografías y
  completar la información.

Si la fecha es futura, la actividad se crea como pública (`is_private = false`),
igual que antes.

No existe validación que obligue a registrar únicamente actividades futuras: se
aceptan fechas pasadas.

## Reglas de una actividad privada

- **Pertenece solo a su creador.**
- **No aparece en el listado público** (`GET /api/v1/activities`) ni en el
  conteo por zonas (`GET /api/v1/activities/zones`).
- **No acepta participantes**: `POST /api/v1/activities/{id}/join` responde
  `404` (no se revela su existencia).
- **No es visible para otros usuarios** (incluidos SEP y admin):
  `GET /api/v1/activities/{id}`, `/membership` y `/attendees` responden `404`
  para quien no es el creador.
- Sí es visible para el creador por enlace directo y en
  `GET /api/v1/activities/mine`.
- Se usa únicamente para **validar horas externas**.

## Archivos

### Backend (`apps/api`)

| Archivo | Cambio |
| --- | --- |
| `app/db/models/activities.py` | Nueva columna `is_private` (bool, default `false`). |
| `alembic/versions/019_add_activity_private.py` | Migración que agrega `is_private`. |
| `app/api/v1/activities.py` — `create_activity` | Marca `is_private` si la fecha fin/inicio ya pasó. |
| `app/api/v1/activities.py` — `list_activities` / `list_zones` | Excluyen `is_private`. |
| `app/api/v1/activities.py` — `get_activity` / `check_membership` / `list_attendees` / `join_activity` | Bloquean el acceso de no-creadores a privadas (`404`). |
| `app/api/v1/activities.py` — `_serialize_activity` | Expone `is_private`. |

### Frontend (`apps/web`)

| Archivo | Cambio |
| --- | --- |
| `components/crear-activity-client.tsx` | Detecta fecha pasada, muestra aviso y cambia el texto del botón; la redirección a la vista individual ya existía. |
| `app/(app)/voluntarios/[id]/page.tsx` | Badge "Registro privado" y tipo `is_private`. |

## Pruebas

`apps/api/tests/test_activity_visibility.py` cubre: marcado como privada al
crear con fecha pasada, exclusión del feed/zonas, visibilidad solo para el
creador (404 para terceros y admin) y rechazo de inscripciones.
