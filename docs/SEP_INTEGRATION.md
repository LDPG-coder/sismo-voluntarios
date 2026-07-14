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

### 2.3 Entregar la identidad del usuario (sin re-login)

Cuando un usuario con sesión en el SEP hace clic en el enlace, el backend del
SEP genera un código de acceso de un solo uso y redirige al navegador a
SISMO-Voluntarios, que lo canjea por una sesión. El procedimiento es el
siguiente:

1. El backend del SEP llama a SISMO de servidor a servidor:

   ```
   POST https://sep.org/voluntarios-becarios/api/v1/auth/sep-login
   Authorization: Bearer <SISMO_SEP_API_TOKEN>
   Content-Type: application/json

   {
     "sep_user_id": "<id estable y único del usuario en SEP>",
     "email": "usuario@sep.org",
     "name": "Nombre Apellido",
     "role": "admin" | "volunteer" | null
   }
   ```

   SISMO responde `{ "code": "<codigo_una_vez>" }`.

2. El backend del SEP redirige al navegador a:

   ```
   https://sep.org/voluntarios-becarios/auth/sep?code=<codigo_una_vez>
   ```

3. SISMO canjea el código, crea o actualiza el usuario y entrega la cookie de
   sesión. El usuario entra a SISMO-Voluntarios sin iniciar sesión de nuevo.

`sep_user_id` debe ser estable y único en SEP (PK o UUID). Si cambia, SISMO
crea otra cuenta distinta.

### 2.4 Mostrar la campana de notificaciones de SISMO en el header del SEP

El backend del SEP consulta, para el usuario actual, la Partner API de SISMO:

```
GET https://sep.org/voluntarios-becarios/partner/v1/users/{sep_user_id}/notifications/summary
Authorization: Bearer <SISMO_SEP_API_TOKEN>
```

La respuesta es `{ "unread": <int>, "items": [...] }`. El SEP pinta el contador
`unread` en la campana que ya usa en todo el sitio para presentar las
notificaciones de inscripciones a las actividades de la persona (por ejemplo,
cuando se cancela una inscripción). Si la llamada falla, el SEP muestra `0` para
no romper el header. Al hacer clic en la campana, el SEP enlaza a
`https://sep.org/voluntarios-becarios/`.

### 2.5 Cerrar la sesión de SISMO al salir del SEP

Cuando el usuario cierra sesión en el SEP, el SEP también termina la sesión de
SISMO-Voluntarios. Como SISMO se sirve bajo el dominio del SEP, el SEP elimina
la cookie `sismo_session` (con `Domain=sep.org` y `Path=/`) mediante
`Set-Cookie` y `Max-Age=0` (o `Expires` pasado).

## 3. Tokens y endpoints

| Elemento | Uso |
|---|---|
| `SISMO_SEP_API_TOKEN` | Token `Bearer` compartido entre SEP y SISMO para `sep-login` y Partner API |
| `POST /api/v1/auth/sep-login` | Genera el código de acceso (server-to-server) |
| `GET /auth/sep?code=` | Canjea el código en el navegador (web de SISMO) |
| `GET /partner/v1/users/{sep_user_id}/notifications/summary` | Resumen de notificaciones (server-to-server) |
| `GET /partner/v1/users/{sep_user_id}/notifications` | Lista de notificaciones (server-to-server) |
| cookie `sismo_session` | Sesión de SISMO; se elimina en el logout del SEP |

## 4. Verificación

- Un usuario con sesión en el SEP hace clic en "Voluntariados" y entra a
  SISMO-Voluntarios sin iniciar sesión.
- El header del SEP muestra el contador de notificaciones de SISMO (inscripciones
  y cancelaciones de actividades).
- Al cerrar sesión en el SEP, la cookie `sismo_session` se elimina y la sesión de
  SISMO-Voluntarios también se cierra.
- Un usuario sin sesión en el SEP (externo) accede a
  `https://sep.org/voluntarios-becarios/login` e inicia sesión con su cuenta propia de
  SISMO.
