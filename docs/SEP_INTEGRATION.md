# Integración SISMO-Voluntarios ⇄ SEP

> **URL:** SISMO-Voluntarios se sirve bajo el dominio del SEP, en la ruta
> `https://sep.org/voluntarios-becarios/`. SISMO corre en su propio servidor
> detrás del proxy del SEP; el sitio del SEP es `sep.org`.

## 1. Arquitectura

SISMO-Voluntarios corre en su propio servidor, pero se expone bajo el dominio
del SEP en la ruta `/voluntarios-becarios` (por ejemplo
`https://sep.org/voluntarios-becarios/`), servido a través del proxy del SEP.
Ese servidor renderiza su propio header y su propio sidebar. La apariencia de
ese header y de ese sidebar imita la del sitio del SEP.

El sidebar de SISMO-Voluntarios reproduce la navegación del sitio del SEP:
muestra las mismas páginas que contiene el SEP. Esas páginas del SEP pueden
requerir sesión de SEP, por lo que su acceso y su autenticación las gestiona el
SEP, no SISMO. SISMO solo enlaza a ellas; el SEP es el responsable de que esas
rutas estén disponibles y de validar la sesión del usuario al servirlas. Este
punto se debe acordar y gestionar junto con el SEP (ver §2.2).

El contenido de SISMO-Voluntarios (actividades, voluntarios, constancias, etc.)
se crea y se administra desde el panel de administración de SISMO. El SEP no
gestiona ese contenido.

> **SISMO se sirve como "una página más" del SEP, nunca dentro de un
> `<iframe>`.** Hay dos formas equivalentes de lograrlo, a elección del SEP:
>
> 1. **Reverse proxy:** SISMO corre en su propio servidor y el SEP hace proxy
>    de `/voluntarios-becarios` hacia él.
> 2. **Contenedor:** los contenedores de SISMO (`web` + `api`) corren dentro del
>    stack del SEP (red Docker compartida, ver `docs/DEPLOYMENT.md` →
>    "Desacoplar servicios" y `infra/docker-compose.network.yml`) y el SEP los
>    enruta por nombre de servicio.
>
> En ambos casos, cuando SISMO se sirve en un sub-path (`/voluntarios-becarios`)
> se construye el web con `NEXT_PUBLIC_BASE_PATH=/voluntarios-becarios`. El
> chrome (header/sidebar propios que imitan al SEP) lo decide SISMO según el
> tipo de cuenta (`auth_source`), no un contexto de iframe.

El SEP enlaza a SISMO-Voluntarios desde su propio sidebar. Los usuarios con
sesión en el SEP acceden a SISMO-Voluntarios sin volver a iniciar sesión. El SEP
muestra en su header general la campana de notificaciones de SISMO para presentar
las notificaciones de inscripciones a las actividades de la persona (por
ejemplo, cuando se cancela una inscripción).

## 2. Responsabilidades del SEP

### 2.1 Agregar el enlace en el sidebar del SEP

El SEP agrega un ítem de menú "Voluntariados" que apunta a la URL de
SISMO-Voluntarios (`https://sep.org/voluntarios-becarios/`). Es un enlace normal del
sitio; no se embebe código de SISMO.

### 2.2 Coordinar la navegación del sidebar de SISMO-Voluntarios con el SEP

El sidebar de SISMO-Voluntarios reproduce la navegación del sitio del SEP e
incluye las mismas páginas que el SEP. Parte de esas páginas son servidas por el
SEP y pueden exigir una sesión de SEP válida. Por ese motivo, el SEP debe
gestionar el acceso y la autenticación de dichas páginas; SISMO se limita a
mostrar los enlaces hacia ellas. El SEP y SISMO deben acordar qué páginas del
SEP aparecen en el sidebar de SISMO-Voluntarios y asegurar que quien haga clic
en ellas sea redirigido al SEP y autenticado por el SEP, sin que SISMO tenga que
validar esa sesión.

**Contrato de navegación (SEP es la fuente):** para no duplicar ni desfasar la
estructura del SEP, SISMO **consume** la navegación desde un endpoint JSON que
el SEP expone (en su propio stack). SISMO lo obtiene server-to-server en cada
render del app shell, con timeout corto y *fallback* a una lista vacía si el SEP
no responde (la navegación del SEP es una mejora, nunca una dependencia dura).

```
GET <SEP_NAVIGATION_URL>   # configurado en SISMO vía SEP_NAVIGATION_URL
Accept: application/json
→ 200 { "items": [ { "label": "...", "href": "https://sep.org/..." }, ... ] }
```

Cada `item` tiene `label` (texto del enlace) y `href` (URL absoluta o relativa a
`sep.org`); `requiresSession` es un campo opcional e informativo que SISMO no
usa para bloquear (pinta todos los items como enlaces). SISMO renderiza esos
`items` bajo la categoría "Portal SEP" del sidebar
(`apps/web/components/sidebar.tsx`, fetcher en `apps/web/lib/sep-nav.ts`). SEP
es dueño de la lista; cualquier cambio de nombre/estructura en el SEP se refleja
sin tocar el código de SISMO.

**Qué debe enviar SISMO al navegar desde SISMO hacia páginas del SEP:** porque
SISMO se sirve bajo el dominio del SEP (`sep.org`, mismo origen cuando va por
proxy reverso o contenedor), el navegador **ya porta la cookie de sesión del
SEP** al hacer clic en esos enlaces, por lo que SEP autentica al usuario sin que
SISMO deba inyectar ningún token. En concreto:

- Si el SEP sirve esas páginas en el mismo origen (proxy reverso / contenedor en
  `sep.org`), **no se requiere ningún parámetro adicional**: basta con el `href`
  tal cual lo devuelve el JSON.
- Si el SEP necesita **correlacionar** el tráfico (p. ej. un parámetro
  `?from=voluntarios`, un return URL firmado, o un contexto de "viniste desde
  SISMO"), el SEP debe indicarlo en el contrato y SISMO debe **agregar ese
  parámetro a cada `href`** antes de renderizarlo. Esto se acuerda en §2.2 y se
  implementa en `lib/sep-nav.ts` / `sidebar.tsx`; mientras el SEP no lo pida,
  SISMO pasa el `href` sin modificarlo.
- SISMO **nunca** reenvía el `SISMO_SEP_*` token ni la sesión de SISMO hacia las
  páginas del SEP; esas páginas las controla y autentica el SEP.

### 2.3 Entregar la identidad del usuario (sin re-login)

Cuando un usuario con sesión en el SEP hace clic en el enlace, el backend del
SEP genera un código de acceso de un solo uso y redirige al navegador a
SISMO-Voluntarios, que lo canjea por una sesión. El flujo usa **PKCE (S256)**
para que un código interceptado en la URL no pueda ser canjeado por un tercero.

1. El backend del SEP genera un `code_verifier` aleatorio (mín. 43 chars) y su
   `code_challenge = base64url(sha256(code_verifier))`. Luego llama a SISMO de
   servidor a servidor:

   ```
   POST https://sep.org/voluntarios-becarios/api/v1/auth/sep-login
   Authorization: Bearer <SISMO_SEP_LOGIN_TOKEN>
   Content-Type: application/json

   {
     "sep_user_id": "<id estable y único del usuario en SEP>",
     "email": "usuario@sep.org",
     "name": "Nombre Apellido",
     "role": "admin" | "volunteer" | null,
     "code_challenge": "<base64url(sha256(code_verifier))>"
   }
   ```

   SISMO responde `{ "code": "<codigo_una_vez>" }`. El código tiene un TTL corto
   (`SISMO_SEP_CODE_TTL_SECONDS`, 120 s por defecto) y es de un solo uso.

2. El backend del SEP redirige al navegador a:

   ```
   https://sep.org/voluntarios-becarios/auth/sep?code=<codigo_una_vez>&code_verifier=<code_verifier>
   ```

   El `code_verifier` viaja en la URL del redirect (exposición limitada: el
   código es de un solo uso y de TTL corto, y está atado al `code_challenge`).

3. SISMO canjea el código vía `POST /api/v1/auth/exchange` presentando el
   `code_verifier`; SISMO verifica S256 y, si coincide, crea/actualiza el usuario
   y entrega la cookie de sesión. El usuario entra a SISMO-Voluntarios sin
   iniciar sesión de nuevo.

> **Tokens:** el handshake de login usa `SISMO_SEP_LOGIN_TOKEN` (distinto del de
> la Partner API). Si un solo `SISMO_SEP_API_TOKEN` antiguo está configurado,
> SISMO lo usa como fallback de ambos, pero lo recomendado es provisionar SEP
> con **dos tokens distintos** para limitar el alcance de una fuga (ver §3).

`sep_user_id` debe ser estable y único en SEP (PK o UUID). Si cambia, SISMO
crea otra cuenta distinta.

> **Nota de seguridad:** SISMO **no** confía en el `role` enviado por SEP para
> otorgar admin; un usuario SEP nuevo siempre es `volunteer` y la promoción a
> admin sólo ocurre vía el endpoint admin-only `PATCH /users/{id}`. Así, la fuga
> del `SISMO_SEP_LOGIN_TOKEN` no permite acuñar cuentas admin.

### 2.4 Mostrar la campana de notificaciones de SISMO en el header del SEP

El backend del SEP consulta, para el usuario actual, la Partner API de SISMO:

```
GET https://sep.org/voluntarios-becarios/api/v1/partner/v1/users/{sep_user_id}/notifications/summary
Authorization: Bearer <SISMO_SEP_PARTNER_TOKEN>
```

La respuesta es `{ "unread": <int>, "items": [...] }`. El SEP pinta el contador
`unread` en la campana que ya usa en todo el sitio para presentar las
notificaciones de inscripciones a las actividades de la persona (por ejemplo,
cuando se cancela una inscripción). Al hacer clic en la campana, el SEP enlaza a
`https://sep.org/voluntarios-becarios/`.

**Resiliencia de la llamada server-to-server (importante):** la campana del SEP
depende de SISMO, así que el SEP debe aislarse de fallos de SISMO:

- **Timeout corto** (p. ej. 2–3 s) en la llamada a la Partner API; nunca dejarla
  colgar el render del header del SEP.
- **Circuit breaker / reintentos acotados:** si SISMO cae o responde 5xx, el SEP
  debe degradar a contador `0` y no reintentar en bucle ni cachear un valor
  errado indefinidamente.
- **Fallback:** ante error (timeout, 401/403 por token, 5xx), el SEP muestra `0`
  para no romper el header, igual que hoy.
- **Caching opcional:** se puede cachear el resumen unos segundos (TTL corto) en
  el SEP para evitar consultar SISMO en cada request, pero el contador nunca
  debe quedar "pegado" si SISMO vuelve.
- El token usado aquí es **`SISMO_SEP_PARTNER_TOKEN`** (solo lectura). Una fuga
  de este token solo expone datos de notificaciones, no permite acuñar sesiones.

### 2.5 Cerrar la sesión de SISMO al salir del SEP

Cuando el usuario cierra sesión en el SEP, el SEP también termina la sesión de
SISMO-Voluntarios. Como SISMO se sirve bajo el dominio del SEP, hay dos acciones
coordinadas:

1. **Logout server-to-server (cierre real en SISMO):** el backend del SEP llama
   a SISMO para invalidar la sesión del usuario, no solo la cookie:

   ```
   POST https://sep.org/voluntarios-becarios/api/v1/auth/sep-logout
   Authorization: Bearer <SISMO_SEP_LOGIN_TOKEN>
   Content-Type: application/json

   { "sep_user_id": "<id estable y único del usuario en SEP>" }
   ```

   SISMO rota la familia de refresh tokens del usuario
   (`revoke_user_sessions`), invalidando todos los refresh tokens en curso. Es
   idempotente: si el usuario no existe en SISMO, responde `204` igual. El
   token es el mismo de login (`SISMO_SEP_LOGIN_TOKEN`).

2. **Borrado de cookie:** además, el SEP elimina la cookie `sismo_session`
   (con `Domain=sep.org` y `Path=/`) mediante `Set-Cookie` y `Max-Age=0` (o
   `Expires` pasado). Esto cubre el access cookie de corta duración mientras el
   paso 1 mata los refresh tokens.

## 3. Tokens y endpoints

| Elemento | Uso |
| --- | --- |
| `SISMO_SEP_LOGIN_TOKEN` | Token `Bearer` **solo** para el handshake de login (`POST /sep-login`) y logout coordinado (`POST /sep-logout`). Un leak crítico: permite acuñar sesiones por cualquier `sep_user_id`. |
| `SISMO_SEP_PARTNER_TOKEN` | Token `Bearer` **solo lectura** para la Partner API (notificaciones del header del SEP). Un leak expone solo datos de notificaciones. |
| `SISMO_SEP_API_TOKEN` (deprecado) | Secreto único anterior que autorizaba ambos canales. SISMO lo usa como fallback si no defines los dos anteriores. Provisionar SEP con dos tokens distintos. |
| `SISMO_SEP_CODE_TTL_SECONDS` | TTL (s) del one-time code de login SEP. Corto (120 por defecto) para limitar la ventana de replay. |
| `POST /api/v1/auth/sep-login` | Genera el código de acceso (server-to-server, con `code_challenge` PKCE) |
| `POST /api/v1/auth/exchange` | Canjea el código presentando `code_verifier` (PKCE S256) |
| `POST /api/v1/auth/sep-logout` | Logout coordinado server-to-server (invalida la sesión SISMO del usuario) |
| `GET /api/v1/partner/v1/users/{sep_user_id}/notifications/summary` | Resumen de notificaciones (server-to-server, token Partner) |
| `GET /api/v1/partner/v1/users/{sep_user_id}/notifications` | Lista de notificaciones (server-to-server, token Partner) |
| cookie `sismo_session` | Sesión de SISMO; se elimina en el logout del SEP y se invalida vía `sep-logout` |

## 4. Verificación

- Un usuario con sesión en el SEP hace clic en "Voluntariados" y entra a
  SISMO-Voluntarios sin iniciar sesión.
- El header del SEP muestra el contador de notificaciones de SISMO (inscripciones
  y cancelaciones de actividades).
- Al cerrar sesión en el SEP, la cookie `sismo_session` se elimina y la sesión de
  SISMO-Voluntarios también se cierra (vía `POST /api/v1/auth/sep-logout`, que
  invalida los refresh tokens del usuario).
- El código de login SEP es de un solo uso y expira en `SISMO_SEP_CODE_TTL_SECONDS`;
  reusarlo o presentar un `code_verifier` incorrecto falla.
- Un usuario sin sesión en el SEP (externo) accede a
  `https://sep.org/voluntarios-becarios/login` e inicia sesión con su cuenta propia de
  SISMO.
