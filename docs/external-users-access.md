# Acceso de usuarios externos (TEMPORAL)

> **Estado:** Cambio temporal en producción. Pedido para habilitar que las
> personas externas (cuentas OAuth de Google, `auth_source = "google"`) puedan
> crear actividades y tener acceso de administración, igual que los usuarios
> SEP / admins.
>
> **Cómo revertir:** cada bloque modificado quedó con el código original
> **comentado** y una marca `TEMPORAL (ver docs/external-users-access.md)`.
> Para revertir, basta con des-comentar el código original y borrar la versión
> nueva en cada archivo listado abajo. No requiere migración de BD.

## Qué se habilitó

1. **Crear actividades** (`POST /api/v1/activities`) — antes solo SEP/admins.
2. **Ceder cupo a cualquiera** (`POST /api/v1/activities/{id}/transfer`) — antes
   los externos solo podían ceder a otros externos.
3. **Ver inscritos de cualquier actividad** (`GET /api/v1/activities/{id}/attendees`)
   — antes solo el creador, SEP o admins.
4. **Ver todos los voluntarios en el directorio** (`GET /api/v1/users/directory`)
   — antes los externos solo veían cuentas Google.
5. **Acceso al panel de administración** (rutas con `require_admin_session` y la
   página `/admin/usuarios`) — antes solo `role = admin`.

El backend (`require_admin_session`) es la fuente de verdad: sigue bloqueando a
cualquiera que no sea `role = admin` ni `auth_source = google`.

## Cambios en el backend (`apps/api`)

| Archivo | Qué se hizo |
| --- | --- |
| `app/api/v1/activities.py` — `create_activity` | Se comentó el `raise` que bloqueaba cuentas no-SEP/no-admin. |
| `app/api/v1/activities.py` — `transfer_activity` | `can_cede_to_anyone` ahora también es `True` para `auth_source = "google"`; se comentó el `raise`. |
| `app/api/v1/activities.py` — `list_attendees` | Se comentó el bloqueo para cuentas externas. |
| `app/api/v1/users.py` — `user_directory` | Se comentó el filtro `q.where(User.auth_source == "google")`. |
| `app/pipeline/dependencies.py` — `make_require_session` | En la rama `role == UserRole.admin`, se permiten cuentas `auth_source = "google"` (el `raise` quedó dentro de `if user.auth_source != "google":`). |

## Cambios en el frontend (`apps/web`)

| Archivo | Qué se hizo |
| --- | --- |
| `components/nav-bar.tsx` | `canCreate` ahora también `\|\| user?.auth_source === "google"`. |
| `components/app-shell.tsx` | `canCreate` ahora también `\|\| user?.auth_source === "google"`. |
| `components/mis-actividades-client.tsx` | `canCreate` ahora también `\|\| user?.auth_source === "google"`. |
| `app/(app)/admin/layout.tsx` | Se quitó el `redirect` por `role !== "admin"`; ahora solo `await requireSession()` (el backend decide). |

## Notas de seguridad

- Los usuarios externos (Google) ahora pueden editar roles/estado de otros
  usuarios vía el panel de admin (`PUT /api/v1/users/{id}`), porque
  `require_admin_session` los deja pasar. Revertir si esto no es deseado.
- No se modificó el esquema de la sesión; el layout de admin delega la
  autorización al backend.
- Migración relacionada pero **independiente**: `011_add_external_official`
  (campos de "voluntariado oficial externo"). No afecta este cambio.
