# Acceso de usuarios externos

> **Estado:** Unificado. Los usuarios externos (OAuth de Google,
> `auth_source = "google"`) tienen los mismos permisos de gestión que los
> usuarios SEP voluntarios: pueden **crear actividades**, editar las propias,
> administrar participantes y usar todas las herramientas disponibles para SEP.
> La única diferenciación que se conserva es la estrictamente necesaria (ver
> abajo).
>
> **Alta de usuarios desactivada:** no existe ningún mecanismo de incorporación
> de usuarios desde la app (ni registro, ni invitación por token, ni invitación
> por email, ni auto-registro en el login de Google). Todas las cuentas se
> cargan manualmente en la base de datos. El login de Google solo funciona para
> cuentas ya existentes.

## Permisos unificados (SEP ≡ externo voluntario)

Lo que un usuario externo **puede** hacer hoy, igual que un usuario SEP:

1. **Crear actividades** (`POST /api/v1/activities`) — cualquier sesión activa.
2. **Editar/cancelar sus propias actividades** — por propiedad (`creator_id`), no
   por tipo de cuenta.
3. **Administrar participantes** de sus actividades (ver inscritos, marcar
   asistencia, ceder cupo dentro de las reglas PII, expandir cupo).
4. **Unirse / salir** de actividades.
5. **Acceder a todas las herramientas** disponibles para usuarios SEP
   voluntarios en el frontend (botón "Crear", panel flotante, etc.).

## Diferenciación que se conserva (estrictamente necesaria)

Estos puntos **no** se unifican, porque protegen PII o responsabilidades de
administración, o porque dependen del portal SEP:

- **Rutas de administración** (`require_admin_session`, `/admin/usuarios`,
  `PUT /api/v1/users/{id}`): solo `role = admin`.
- **Directorio de usuarios** (`GET /api/v1/users/directory`): los externos solo
  ven cuentas Google. Se mantiene por privacidad de datos SEP y para la futura
  integración SEP.
- **Ceder cupo** (`POST /api/v1/activities/{id}/transfer`): un externo solo puede
  ceder a otro externo. Se mantiene por lo mismo (futura integración SEP).
- **Ver inscritos ajenos** (`GET /api/v1/activities/{id}/attendees`): solo el
  creador, SEP o admin (cada uno gestiona sus propias actividades).
- **Chrome SEP vs externo**: los usuarios SEP ven el header + sidebar que imita
  al portal SEP; los externos ven `ExternalShell` (header sin sidebar + nav
  flotante). Es una diferencia de presentación, no de permisos.

## Alta de usuarios desactivada

Todos los mecanismos de onboarding desde la app están desactivados
(temporalmente, a la espera de definir el flujo definitivo). No hay forma de
que un usuario nuevo se dé de alta por sí mismo ni sea invitado desde la
interfaz:

| Mecanismo | Estado | Archivo |
| --- | --- | --- |
| Registro / invitación por token (`POST /api/v1/auth/referral`) | Desconectado (ruta comentada) | `app/api/v1/auth.py` |
| Invitación por email (`POST /api/v1/auth/invite`) | Desconectado (ruta comentada) | `app/api/v1/auth.py` |
| Auto-registro en callback Google (`OAuthNotInvitedError`) | Bloquea cuentas no existentes | `app/pipeline/oauth.py` |
| Página `/registro` | Redirige a `/login` | `app/registro/page.tsx` |
| `ReferralBox` / `InviteForm` en perfil | Eliminados | `app/(app)/perfil/page.tsx` |

El código desactivado se conserva **comentado** para facilitar su restauración.
El login de Google para una cuenta que no existe previamente responde con
`auth.not_invited` y el mensaje "Tu cuenta no está registrada en SISMO."

## Cambios en el backend (`apps/api`)

| Archivo | Estado actual |
| --- | --- |
| `app/api/v1/activities.py` — `create_activity` | Sin restricción por `auth_source`; cualquier sesión activa crea. |
| `app/api/v1/activities.py` — `transfer_activity` | `can_cede_to_anyone` solo SEP/admins (se mantiene PII). |
| `app/api/v1/activities.py` — `list_attendees` | Bloqueo para no-creadores (se mantiene). |
| `app/api/v1/users.py` — `user_directory` | Filtro `auth_source == "google"` para externos (se mantiene PII). |
| `app/api/v1/auth.py` — `invite_user` / `validate_referral` | Rutas comentadas (alta desactivada). |
| `app/pipeline/oauth.py` — `_resolve_or_create_user` | Paso 3 bloquea cuentas inexistentes (sin auto-registro). |
| `app/pipeline/dependencies.py` — `make_require_session` | `require_admin_session` solo para admin. |

## Cambios en el frontend (`apps/web`)

| Archivo | Estado actual |
| --- | --- |
| `components/nav-bar.tsx` | `canCreate` = `!!user`. |
| `components/header-bar.tsx` | `canCreate` = `!!user`. |
| `components/mis-actividades-client.tsx` | `canCreate` = `!!user`. |
| `components/todas-actividades-client.tsx` | `canCreate` = `!!user`. |
| `app/login/page.tsx` | Sin link a `/registro`; banner `not_invited` dice "no registrada". |
| `app/(app)/perfil/page.tsx` | Sin `ReferralBox` ni `InviteForm`. |
| `app/registro/page.tsx` | Redirige a `/login`. |

## Notas de seguridad

- `require_admin_session` sigue bloqueando a cualquiera que no sea `role =
  admin` (incluidos usuarios externos Google). El panel de admin no es
  alcanzable por cuentas voluntarias, ni pueden editar roles/estado.
- La diferenciación SEP/externo ya no habilita ni bloquea capacidades de
  gestión de actividades; solo afecta PII (directorio, ceder cupo), admin y el
  chrome de navegación.
- No se modificó el esquema de la sesión.

## Chrome para usuarios externos (OAuth)

Los usuarios SEP ven el chrome que imita al portal SEP: header propio **más**
sidebar (cuyo contenido SISMO consume en vivo desde el SEP, ver
`docs/SEP_INTEGRATION.md` §2.2). Los usuarios externos **no** ven ese sidebar:
pertenece al SEP. El header sí se muestra a todos, adaptado.

- Se muestra el mismo header superior (notificaciones, tema, menú de perfil).
  La opción "crear actividad" aparece para **cualquier usuario autenticado**
  (`canCreate = !!user`), incluidos los externos con rol voluntario.
- No se muestra el sidebar ni el botón hamburguesa; navegan con el panel
  flotante y el FAB en teléfono.
- El menú de la foto de perfil muestra el perfil propio y el logout de SISMO.

Implementación: `components/header-bar.tsx` lo comparten `AppShell` (SEP) y
`ExternalShell` (OAuth).

## Logout según el tipo de usuario

- **Usuario del SEP:** logout del SEP (cierra ambas sesiones y redirige al
  login del SEP).
- **Usuario OAuth (externo):** logout de SISMO (solo cierra SISMO-Voluntarios y
  redirige al login de SISMO).
