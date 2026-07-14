# Integración SISMO-Voluntarios ⇄ SEP

> **Dominios de ejemplo:** en este documento se usa `voluntarios.sep.org` como
> la URL del servidor propio de SISMO-Voluntarios y `sep.org` como el sitio del
> SEP. Sustituir por las URLs reales en cada caso.

## 1. Arquitectura

SISMO-Voluntarios se despliega como un servidor independiente (su propio
dominio o subdominio de SEP). Ese servidor renderiza su propio header y su
propio sidebar. La apariencia de ese header y de ese sidebar imita la del sitio
del SEP: el SEP entrega a SISMO el markup y el CSS de su header y de su sidebar,
y SISMO construye el suyo propio con esa misma apariencia.

El contenido de SISMO-Voluntarios (actividades, voluntarios, constancias, etc.)
se crea y se administra desde el panel de administración de SISMO. El SEP no
gestiona ese contenido.

El SEP enlaza a SISMO-Voluntarios desde su propio sidebar. Los usuarios con
sesión en el SEP acceden a SISMO-Voluntarios sin volver a iniciar sesión. El SEP
muestra en su header general la campana de notificaciones de SISMO.

## 2. Responsabilidades del SEP

### 2.1 Entregar la referencia visual de SEP

El equipo de SEP entrega a SISMO el markup y el CSS del header y del sidebar del
sitio del SEP (o una especificación de diseño equivalente). SISMO usa esa
referencia para construir el header y el sidebar de SISMO-Voluntarios de forma
que imiten la apariencia del SEP. SISMO renderiza su propio chrome; el SEP no
alojа ni embebe la interfaz de SISMO.

### 2.2 Agregar el enlace en el sidebar del SEP

El SEP agrega un ítem de menú "Voluntariados" que apunta a la URL de
SISMO-Voluntarios (`https://voluntarios.sep.org/`). Es un enlace normal del
sitio; no se embebe código de SISMO.

### 2.3 Entregar la identidad del usuario (sin re-login)

Cuando un usuario con sesión en el SEP hace clic en el enlace, el backend del
SEP genera un código de acceso de un solo uso y redirige al navegador a
SISMO-Voluntarios, que lo canjea por una sesión. El procedimiento es el
siguiente:

1. El backend del SEP llama a SISMO de servidor a servidor:

   ```
   POST https://voluntarios.sep.org/api/v1/auth/sep-login
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
   https://voluntarios.sep.org/auth/sep?code=<codigo_una_vez>
   ```

3. SISMO canjea el código, crea o actualiza el usuario y entrega la cookie de
   sesión. El usuario entra a SISMO-Voluntarios sin iniciar sesión de nuevo.

`sep_user_id` debe ser estable y único en SEP (PK o UUID). Si cambia, SISMO
crea otra cuenta distinta.

### 2.4 Mostrar la campana de notificaciones de SISMO en el header del SEP

El backend del SEP consulta, para el usuario actual, la Partner API de SISMO:

```
GET https://voluntarios.sep.org/partner/v1/users/{sep_user_id}/notifications/summary
Authorization: Bearer <SISMO_SEP_API_TOKEN>
```

La respuesta es `{ "unread": <int>, "items": [...] }`. El SEP pinta el contador
`unread` en la campana que ya usa en todo el sitio. Si la llamada falla, el SEP
muestra `0` para no romper el header. Al hacer clic en la campana, el SEP
enlaza a `https://voluntarios.sep.org/`.

### 2.5 Cerrar la sesión de SISMO al salir del SEP

Cuando el usuario cierra sesión en el SEP, el SEP también termina la sesión de
SISMO-Voluntarios. El SEP redirige al navegador al endpoint de logout de SISMO
(`https://voluntarios.sep.org/auth/logout`) o, si SISMO se sirve en un
subdominio de SEP, elimina la cookie `sismo_session` con `Set-Cookie` y
`Max-Age=0`.

## 3. Tokens y endpoints

| Elemento | Uso |
|---|---|
| `SISMO_SEP_API_TOKEN` | Token `Bearer` compartido entre SEP y SISMO para `sep-login` y Partner API |
| `POST /api/v1/auth/sep-login` | Genera el código de acceso (server-to-server) |
| `GET /auth/sep?code=` | Canjea el código en el navegador (web de SISMO) |
| `GET /partner/v1/users/{sep_user_id}/notifications/summary` | Resumen de notificaciones (server-to-server) |
| `GET /partner/v1/users/{sep_user_id}/notifications` | Lista de notificaciones (server-to-server) |
| `GET /auth/logout` | Cierre de sesión de SISMO |

## 4. Verificación

- Un usuario con sesión en el SEP hace clic en "Voluntariados" y entra a
  SISMO-Voluntarios sin iniciar sesión.
- El header del SEP muestra el contador de notificaciones de SISMO.
- Al cerrar sesión en el SEP, la sesión de SISMO-Voluntarios también se cierra.
- Un usuario sin sesión en el SEP (externo) accede a
  `https://voluntarios.sep.org/login` e inicia sesión con su cuenta propia de
  SISMO.
