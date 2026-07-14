# Incubadora — Sección desconectada (no visible en prod)

**Estado:** desactivada temporalmente. La funcionalidad existe en el código pero
no se expone ni en el frontend ni en el backend.

**Motivo:** por decisión de producto, la sección de Incubadora de Proyectos no
debe verse todavía en producción. Se optó por **desconectarla** (comentar y
aislar) en lugar de borrarla, para poder reactivarla fácilmente cuando se
decida.

---

## Qué se dejó (y por qué)

Se conserva TODO el código de la Incubadora en el repo; solo se corta su
"cableado" (rutas, navegación, router y dependencias). Así reactivarla es
revertir unos pocos puntos, sin reescribir nada.

Archivos conservados intactos:

- **Frontend:** `apps/web/components/incubadora/*` (14 componentes: editor de
  propuestas, tarjetas, formularios de evaluación, contribución, presupuesto,
  timeline, etc.).
- **Backend:** `apps/api/app/api/v1/incubator.py` (router), 
  `apps/api/app/ai/format_text.py` (formateo IA de propuestas),
  `apps/api/app/db/models/incubator_project.py` (modelos),
  `apps/api/alembic/versions/013_incubator.py` (migración) y
  `apps/api/tests/test_incubator.py`.

La migración `013_incubator` **ya está aplicada** en la base de datos, así que
las tablas `incubator_*` existen. No se tocan; simplemente no hay endpoints que
las usen mientras la sección esté desactivada.

---

## Qué se desconectó

### Frontend (`apps/web`)

- `components/nav-config.tsx`: se comentó la entrada de navegación
  `{ href: "/incubadora", ... }` → la Incubadora ya no aparece en el menú.
  El `IncubatorIcon` se conserva (con nota) para reactivar.
- Rutas `app/(app)/incubadora/**/page.tsx` (lista, crear, detalle, editar):
  reemplazadas por stubs que llaman `notFound()`. Cualquier acceso directo por
  URL devuelve 404. El código original está en el historial de git.
- `app/api/ai/format-text/route.ts`: proxy usado solo por el editor de la
  Incubadora; devuelve 404 mientras la sección esté desactivada.
- `tsconfig.json`: se excluye `components/incubadora` del typecheck (sus
  componentes importan `tiptap`, cuyas dependencias se desactivaron).
- `package.json`: las dependencias usadas **solo** por la Incubadora se movieron
  desde `dependencies` a la clave `_incubadora_disabled_dependencies` (npm
  ignora claves desconocidas), con una nota en `//_incubadora_disabled`:
  `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`,
  `@tiptap/extension-image`, `@tiptap/extension-placeholder`,
  `@tiptap/extension-underline`, `@tiptap/extension-highlight`,
  `@tiptap/extension-task-list`, `@tiptap/extension-task-item`,
  `@tiptap/extension-table`, `@tiptap/extension-table-row`,
  `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`,
  `tiptap-markdown`, `react-markdown`, `remark-gfm`.
  (`package-lock.json` se regeneró en consecuencia.)

### Backend (`apps/api`)

- `app/api/v1/router.py`: se comentó el import y el `include_router` del
  `incubator_router` → `GET/POST /api/v1/incubator/*` responde 404.
- `app/api/v1/ai.py`: se comentó el import de `format_text` y el endpoint
  `POST /ai/format-text` (lo usaba solo la Incubadora).

---

## Qué se mantuvo activo a propósito

- **`POST /api/v1/ai/suggest/stream`** y su proxy web
  `app/api/ai/suggest/stream/route.ts`: los usa la **creación de actividades**
  (autocompletado con IA), NO la Incubadora.
- Dependencia **`openai`** (`apps/api/requirements.txt`) y la config
  `openai_api_key` / `openai_model`: siguen siendo necesarias para
  `suggest_stream` (actividades). Por eso NO se comentaron.

---

## Cómo reactivar la Incubadora

Todos los puntos llevan un comentario `[INCUBADORA]` para localizarlos. Pasos:

1. `apps/web/components/nav-config.tsx`: descomentar la entrada de navegación.
2. `apps/web/app/(app)/incubadora/**/page.tsx`: restaurar las páginas desde git
   (`git checkout <commit-previo> -- "apps/web/app/(app)/incubadora"`).
3. `apps/web/app/api/ai/format-text/route.ts`: restaurar el proxy original.
4. `apps/web/tsconfig.json`: quitar `components/incubadora` de `exclude`.
5. `apps/web/package.json`: mover las entradas de
   `_incubadora_disabled_dependencies` de vuelta a `dependencies`, borrar la
   nota `//_incubadora_disabled` y correr `npm install`.
6. `apps/api/app/api/v1/router.py`: descomentar import + `include_router`.
7. `apps/api/app/api/v1/ai.py`: descomentar el import de `format_text` y el
   endpoint `/format-text`.
8. Rebuild: `docker compose up -d --build web api` en `infra/` (y luego
   `docker builder prune -a -f`). Las tablas `incubator_*` ya existen.

---

## Verificación tras desconectar

- `GET /api/v1/incubator/projects` → 404.
- `POST /api/v1/ai/format-text` → 404.
- La Incubadora no aparece en el menú de navegación.
- Build de producción del frontend correcto sin las dependencias de `tiptap`.
