# Acceso de usuarios externos

> **Estado:** Cerrado. El cambio temporal que habilitaba a las cuentas OAuth de
> Google (`auth_source = "google"`) crear actividades, ceder cupo a cualquiera,
> ver inscritos ajenos, ver todo el directorio y entrar al panel de
> administración **fue revertido**. Los usuarios externos vuelven a tener los
> permisos originales (solo se unen a actividades; la creación, el ceder a no
> externos, ver inscritos ajenos y el admin quedan reservados a SEP/admins).
>
> **Historial:** esta excepción se documentó originalmente como temporal (ver
> sección "Qué se habilitó" abajo) y se mantenía con bloques marcados
> `TEMPORAL`. Esos bloques se eliminaron; el código original es ahora el que
> está en vigor. No requirió migración de BD.

## Qué se habilitó (y ya fue revertido)

Estos cinco puntos fueron la excepción temporal; **todos fueron revertidos** y
el comportamiento original es el vigente:

1. **Crear actividades** (`POST /api/v1/activities`) — solo SEP/admins.
2. **Ceder cupo a cualquiera** (`POST /api/v1/activities/{id}/transfer`) — los
   externos solo pueden ceder a otros externos.
3. **Ver inscritos de cualquier actividad** (`GET /api/v1/activities/{id}/attendees`)
   — solo el creador, SEP o admins.
4. **Ver todos los voluntarios en el directorio** (`GET /api/v1/users/directory`)
   — los externos solo ven cuentas Google.
5. **Acceso al panel de administración** (rutas con `require_admin_session` y la
   página `/admin/usuarios`) — solo `role = admin`.

El backend (`require_admin_session`) es la fuente de verdad: bloquea a cualquiera
que no sea `role = admin`.

## Cambios en el backend (`apps/api`)

> **Revertido:** los bloques `TEMPORAL` fueron eliminados; el código original
> (que restringe a SEP/admins) es el que está en vigor.

| Archivo | Estado actual |
| --- | --- |
| `app/api/v1/activities.py` — `create_activity` | `raise` restaurado: bloquea cuentas no-SEP/no-admin. |
| `app/api/v1/activities.py` — `transfer_activity` | `can_cede_to_anyone` solo SEP/admins; `raise` restaurado para externos que ceden a no-externos. |
| `app/api/v1/activities.py` — `list_attendees` | Bloqueo restaurado para cuentas externas. |
| `app/api/v1/users.py` — `user_directory` | Filtro `q.where(User.auth_source == "google")` restaurado para externos. |
| `app/pipeline/dependencies.py` — `make_require_session` | `require_admin_session` bloquea a cualquiera que no sea `role = admin` (sin excepción Google). |

## Cambios en el frontend (`apps/web`)

> **Revertido:** los `canCreate` y el `redirect` de admin volvieron a su valor
> original (`auth_source === "sep" \|\| role === "admin"`, y `role !== "admin"` →
> redirige).

| Archivo | Estado actual |
| --- | --- |
| `components/nav-bar.tsx` | `canCreate` = `sep \|\| admin`. |
| `components/header-bar.tsx` | `canCreate` = `sep \|\| admin`. |
| `components/mis-actividades-client.tsx` | `canCreate` = `sep \|\| admin`. |
| `components/todas-actividades-client.tsx` | `canCreate` = `sep \|\| admin`. |
| `app/(app)/admin/layout.tsx` | `redirect("/voluntarios")` si `role !== "admin"`. |

## Notas de seguridad

- Tras revertir, `require_admin_session` bloquea a cualquiera que no sea
  `role = admin` (incluidos los usuarios externos Google). El panel de admin ya
  no es alcanzable por cuentas externas, ni pueden editar roles/estado de otros
  usuarios (`PUT /api/v1/users/{id}`).
- No se modificó el esquema de la sesión; el layout de admin vuelve a redirigir
  con `redirect("/voluntarios")` si `role !== "admin"`.
- Migración relacionada pero **independiente**: `011_add_external_official`
  (campos de "voluntariado oficial externo"). No afecta este cambio.

## Chrome para usuarios externos (OAuth)

Los usuarios SEP ven el chrome de SISMO que imita al SEP: header propio **más**
sidebar (cuyo contenido SISMO consume en vivo desde el SEP, ver
`docs/SEP_INTEGRATION.md` §2.2). Los usuarios externos (OAuth/Google, los que
entran por invitación con token o agregando su correo) **no** ven ese sidebar:
el sidebar pertenece al SEP y su contenido es para cuentas SEP. El header sí se
muestra a todos, pero adaptado.

Para estos usuarios se aplica lo siguiente:

- Sí se muestra el mismo header superior que ven los usuarios SEP, con
  notificaciones, cambio de tema y el menú de la foto de perfil. La opción
  "crear actividad" solo aparece para usuarios SEP o admin (`canCreate =
  auth_source === "sep" || role === "admin"`), por lo que un externo con rol
  voluntario no la ve.
- No se muestra el sidebar, ni en modo escritorio ni en modo responsive; el botón
  hamburguesa tampoco aparece (el header no incluye ese botón para ellos). El
  usuario navega con el panel flotante y el botón (FAB) en teléfono.
- En el menú que se abre al pulsar la foto del perfil del usuario aparecen el
  acceso al perfil propio de SISMO y el logout (que solo cierra la sesión de
  SISMO y redirige al login de SISMO).

Implementación: el header vive en `components/header-bar.tsx` y lo comparten
`AppShell` (usuarios SEP: le pasa el botón hamburguesa que abre el sidebar) y
`ExternalShell` (usuarios OAuth: lo renderiza sin botón de menú).

## Logout según el tipo de usuario

El logout que se muestra depende del tipo de cuenta, y cada uno tiene un
alcance y un destino distintos:

- **Usuario del SEP:** ve el logout del SEP. Al pulsarlo se cierra la sesión en
  ambas plataformas (la de SEP y la de SISMO-Voluntarios) y se redirige a la
  página de login del SEP.
- **Usuario OAuth (externo):** ve el logout de SISMO. Al pulsarlo solo se cierra
  la sesión de SISMO-Voluntarios y se redirige a la página de login de SISMO. No
  afecta la sesión del SEP.
