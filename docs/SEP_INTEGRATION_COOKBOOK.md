# Integración SISMO-Voluntarios ⇄ SEP — Cookbook y contrato

> **Dominios de ejemplo:** en este documento se usa `voluntarios.sep.org` como
> la URL del servidor propio de SISMO-Voluntarios y `sep.org` como el sitio del
> SEP. Sustituir por las URLs reales en cada caso.

Documento complementario de `docs/SEP_INTEGRATION.md`. Contiene los bloques de
código que debe implementar el servidor del SEP. SISMO-Voluntarios se despliega
como un servidor independiente (su propio dominio o subdominio de SEP) con su
propio header y sidebar que imitan la apariencia del SEP; el contenido se
administra desde el panel de SISMO.

Cada bloque indica su estado: **[IMPLEMENTADA]** si ya está en el repositorio de
SISMO, o **[PENDIENTE]** si aún no se aplica del lado del SEP.

---

## A. Contrato de identidad SEP (one-time code)  **[IMPLEMENTADA]**

SISMO expone `POST /api/v1/auth/sep-login` (server-to-server, autenticada con
`Authorization: Bearer <SISMO_SEP_API_TOKEN>`). SEP la llama cuando un usuario
con sesión hace clic en el enlace a SISMO-Voluntarios, recibe un `code` de un
solo uso y redirige al navegador a `GET /auth/sep?code=...` para canjearlo por
la sesión de SISMO. El flujo ya está implementado en SISMO.

**Request:**

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

**Response:** `{ "code": "<codigo_una_vez>" }`

**Redirect del navegador:** `https://voluntarios.sep.org/auth/sep?code=<codigo_una_vez>`

- `sep_user_id` debe ser estable y único en SEP (PK o UUID). Si cambia, SISMO
  crea otra cuenta.
- El `code` tiene corta vigencia (TTL de un solo uso) y se canjea una vez.

---

## B. Lado SEP (especificación, stack-agnóstico)

Lo que SEP debe implementar, descrito como contrato y algoritmo (independiente
del lenguaje o del servidor que SEP use).

### B.1 Generar el código y redirigir (sin re-login)  **[PENDIENTE]**

Cuando un usuario con sesión SEP hace clic en "Voluntariados", el backend de SEP:

1. Llama a `POST /api/v1/auth/sep-login` con el `SISMO_SEP_API_TOKEN` y los datos
   del usuario (`sep_user_id`, `email`, `name`, `role`).
2. Recibe `{ "code": "..." }`.
3. Redirige al navegador a `https://voluntarios.sep.org/auth/sep?code=<code>`.

Pseudocódigo (stack-agnóstico):

```
function onVoluntariosClick(sepUser):
    resp = http.post(
        "https://voluntarios.sep.org/api/v1/auth/sep-login",
        headers = { "Authorization": "Bearer " + SISMO_SEP_API_TOKEN,
                    "Content-Type": "application/json" },
        body   = { "sep_user_id": sepUser.id,
                   "email": sepUser.email,
                   "name": sepUser.name,
                   "role": sepUser.role })
    code = resp.json["code"]
    redirect("https://voluntarios.sep.org/auth/sep?code=" + code)
```

### B.3 Backend de SEP: campana en el header general  **[PENDIENTE]**

Para el usuario actual, SEP consulta la Partner API de SISMO y pinta el
contador en su header. Contrato HTTP:

```
GET https://voluntarios.sep.org/partner/v1/users/{sep_user_id}/notifications/summary
Authorization: Bearer <SISMO_SEP_API_TOKEN>
```

- Respuesta: `{ "unread": <int>, "items": [...] }`.
- Si la llamada falla, usar `{ "unread": 0, "items": [] }` para no romper el
  header.
- Al hacer clic en la campana, el SEP enlaza a `https://voluntarios.sep.org/`.

### B.4 Logout  **[PENDIENTE]**

En el logout global de SEP, además de limpiar la sesión SEP, se termina la
sesión de SISMO-Voluntarios. Como SISMO se sirve en un subdominio de SEP, el SEP
elimina la cookie `sismo_session` con `Set-Cookie` y `Max-Age=0` (o `Expires`
pasado).

---

## C. Contrato Partner API (resumen)  **[IMPLEMENTADA]**

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| `GET` | `/partner/v1/users/{sep_user_id}/notifications/summary` | `Bearer <SISMO_SEP_API_TOKEN>` | `{ "unread": int, "items": [...] }` |
| `GET` | `/partner/v1/users/{sep_user_id}/notifications` | `Bearer <SISMO_SEP_API_TOKEN>` | `[ { id, type, title, message, activity_id, read, created_at } ]` |

- Errores: `401 auth.sep_token_invalid` (token ausente/inválido), `404` si el
  `sep_user_id` no existe en SISMO (la app devuelve `{unread:0,items:[]}` para
  no romper el header).
- `sep_user_id` es el identificador estable de SEP del usuario (el mismo que SEP
  envía en `POST /api/v1/auth/sep-login`).

---

## D. Checklist de verificación

- [x] Partner API implementada en SISMO (`partner.py`, registrada, con tests).
- [x] Flujo `sep-login` / `exchange` implementado en SISMO (identidad SEP por
      one-time code).
- [ ] SEP: agregar enlace "Voluntariados" en su sidebar apuntando al servidor de
      SISMO-Voluntarios (B.1).
- [ ] SEP: coordinar con SISMO qué páginas del SEP aparecen en el sidebar de
      SISMO-Voluntarios y que el SEP gestione su sesión (B.2).
- [ ] SEP: generar el `code` vía `sep-login` y redirigir a `/auth/sep?code=`
      (B.1).
- [ ] SEP: campana en header vía Partner API (B.3).
- [ ] SEP: limpieza de la sesión de SISMO en logout (B.4).
- [x] SISMO usa su propia BD; usuarios `auth_source=sep` (creados/actualizados
      por el flujo `sep-login`).
