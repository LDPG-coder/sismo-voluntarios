# Integración SISMO ⇄ SEP — Horizonte medio/largo plazo (desacoplada)

> **Este documento es el plan de evolución. NO es inmediato:** se construye
> **después** de que la integración primaria de corto plazo
> ([`docs/SEP_INTEGRATION.md`](./SEP_INTEGRATION.md)) esté funcionando en
> producción. El objetivo es reemplazar las partes frágiles del MVP por una
> arquitectura **óptima y desacoplada**, conservando la misma lógica de negocio
> (ceder cupo, notificaciones, directorio, PII).

---

## 1. Contexto: qué funciona hoy (corto plazo) y sus costos

El MVP actual:

- Login SEP → `POST /api/v1/auth/sep-login` (server-to-server, one-time code) →
  iframe `app.sismo.lat/?embed=1` con `EmbeddedShell`.
- Campana de notificaciones de SEP llama a `api.sismo.lat` **desde el browser**
  con la cookie de sesión de SISMO (`SameSite=None`), vía CORS.
- Tema SEP propagado por `?theme=` en la URL del iframe.

Costos / fragilidades que justifican evolucionar:

1. **Dependencias de cookies cross-site.** La campana y la sesión en el iframe
   dependen de que el browser envíe cookies de `sismo.lat` a un contexto de
   terceros (SEP). Los navegadores están dejando de enviar third-party cookies
   por defecto; `SameSite=None` sigue funcionando hoy, pero es frágil a largo
   plazo y rompe si SEP decide aislar su sitio.
2. **Acoplamiento de SEP a la API HTTP de SISMO en el browser.** SEP conoce
   rutas, formatos de respuesta y el modelo de cookie de SISMO para renderizar
   la campana. Cualquier cambio en la API rompe el header de SEP.
3. **Polling de notificaciones** desde el cliente de SEP.
4. **iframe como única opción de embebido**, con sus límites (scroll, focus,
   accesibilidad, deep-linking, tema).

---

## 2. Principios de la evolución

- **La lógica de negocio vive en SISMO; la autenticación de usuario y la
  presentación viven en SEP.** SISMO es el sistema de registro de verdad para
  actividades/voluntarios; SEP es quien autentica a la persona.
- **Desacoplamiento por contrato versionado**, no por detalles internos. Los
  contratos son: API server-to-server firmada, webhooks firmados, y (opcional)
  componentes web versionados. SEP no lee ni escribe cookies de SISMO, no asume
  el dominio, no depende de clases CSS internas.
- **Sin dependencias esenciales de cookies cross-site ni de CORS del browser.**
  Lo que el browser de SEP necesite, lo obtiene vía su propio backend, que sí
  habla server-to-server con SISMO.
- **Poblaciones separadas, reglas de ceder cupo y PII se mantienen** — la
  evolución cambia el *transporte*, no las reglas de negocio.

---

## 3. Opciones (se pueden combinar)

### 3.1 API server-to-server de "socio" (extensión de `SISMO_SEP_API_TOKEN`)

Extiende el patrón ya existente de `sep-login` (SEP backend autenticado con
`Bearer SISMO_SEP_API_TOKEN`) a un conjunto de endpoints de lectura que SEP
consumiría **desde su backend**, no desde el browser:

- `GET /partner/v1/users/{sep_user_id}/notifications` → lista + `unread`.
- `GET /partner/v1/activities` / `GET /partner/v1/activities/{id}` → datos para
  que SEP renderice su propia UI de actividades.
- `GET /partner/v1/users/{sep_user_id}/directory` → directorio visible según
  reglas de ceder cupo.

SEP renderiza su propia UI (header, campana, listas) con esos datos. **Elimina
el iframe, las cookies cross-site y el CORS del browser.** SISMO sigue dueño de
la lógica; SEP solo presenta.

### 3.2 Webhooks / eventos SISMO → SEP (notificaciones en tiempo real)

En vez de que SEP haga polling, SISMO empuja eventos (`activity.created`,
`membership.ceded`, `notification.created`, etc.) a una URL configurada de SEP,
firmados con HMAC (`X-SISMO-Signature`). SEP los usa para actualizar su campana
en tiempo real y para su propio log/auditoría. Desacoplado: SEP solo consume
eventos versionados.

### 3.3 SSO estándar (OIDC / OAuth2 con PKCE)

Reemplaza el one-time code custom por un flujo estándar
(authorization code + PKCE) donde SISMO actúa como IdP (o se federan vía un
broker). Más interoperable y desacoplado de la implementación puntual actual;
permite que otros sistemas se integren con el mismo contrato.

### 3.4 BFF / reverse proxy con header firmado (si se quiere seguir embebiendo)

Si SEP prefiere seguir mostrando la UI de SISMO en su sitio (iframe o proxy),
su gateway: (1) valida la sesión propia de SEP, (2) inyecta `x-sismo-context:
sep` + identidad en headers **firmados por HMAC** (`x-sismo-sig`), y (3) proxea
`/api/v1/*` de SISMO. Para el browser de SEP, las llamadas son **mismo origen**
→ sin CORS ni cookies cross-site. SISMO confía en el gateway por la firma, no
por la red. Es el enfoque "proxy-headers" mencionado en el doc de corto plazo,
pero con firma (no solo secreto de proxy).

### 3.5 Micro-frontend / web components (embebido sin iframe)

SISMO publica un **web component** versionado (p.ej. `<sismo-voluntarios>`)
que SEP importa y monta en su DOM, compartiendo el design system vía un
contrato de props/slots/eventos. Elimina los límites del iframe (scroll, focus,
tema, deep-link) y sigue desacoplado por contrato de componente. SISMO puede
publicarlo como paquete o vía Module Federation.

---

## 4. Camino propuesto (fases)

- **Fase A — API server-to-server de socio + webhooks.** Elimina la campana
  cross-site y el acoplamiento de API en el browser. SEP deja de llamar a
  `api.sismo.lat` desde el cliente; su backend sí lo hace. Riesgo bajo: reusa
  el `SISMO_SEP_API_TOKEN` ya existente.
- **Fase B — SSO OIDC/OAuth2 (opcional).** Estandariza el login y facilita
  futuras integraciones. Se puede hacer en paralelo a A.
- **Fase C — Micro-frontend / web components (si SEP quiere la UI de SISMO sin
  iframe).** Reemplaza el embebido por iframe por un componente versionado.

El corto plazo (iframe + one-time code) queda como MVP; las fases A→C lo
reemplazan por partes, manteniendo la lógica de negocio intacta.

---

## 5. Qué NO cambia

- Poblaciones separadas (`auth_source` google/sep), `sep_user_id` estable.
- Reglas de **ceder cupo** (externo solo a externo; recibe de cualquiera;
  SEP/admin a cualquiera).
- Regla de **PII del creador** (teléfono público solo en la actividad; directorio
  sin teléfono).
- Secretos server-to-server (`SISMO_SEP_API_TOKEN`) como única credencial
  compartida; nunca en el browser.

---

## 6. Boceto de contratos (no implementado)

### 6.1 Partner API (server-to-server)

```
GET https://api.sismo.lat/partner/v1/users/{sep_user_id}/notifications
Headers: Authorization: Bearer <SISMO_SEP_API_TOKEN>
         X-SISMO-Context: sep
-> 200 { "unread": 3, "items": [ { "id", "type", "title", "message",
                                   "activity_id", "read", "created_at" } ] }
```

### 6.2 Webhook (SISMO → SEP)

```
POST https://sep.ejemplo.com/webhooks/sismo
Headers: X-SISMO-Event: notification.created
         X-SISMO-Signature: sha256=<hmac>
Body:    { "sep_user_id", "notification": { ... } }
```

### 6.3 Proxy firmado (BFF)

```
SEP gateway -> SISMO
Headers: x-sismo-context: sep
         x-sismo-user: <sep_user_id>
         x-sismo-sig: sha256=<hmac(secret, context|user|ts)>
         x-sismo-ts: <unix>
```

---

## 7. Relación con el corto plazo

| Aspecto | Corto plazo (hoy) | Largo plazo (este doc) |
|---|---|---|
| Login | one-time code custom | OIDC/OAuth2 (Fase B) o se mantiene |
| Notificaciones | polling cross-site en browser | server-to-server + webhooks (Fase A) |
| Embebido UI | iframe + `?theme=` | micro-frontend/web components (Fase C) o BFF firmado |
| Acoplamiento | SEP conoce API HTTP de SISMO | SEP consume contratos versionados firmados |
| Cookies cross-site | necesarias | eliminadas de lo esencial |

El MVP de corto plazo sigue siendo válido hasta completar la Fase A; desde ahí
se puede ir migrando de a una parte sin romper lo que ya funciona.
