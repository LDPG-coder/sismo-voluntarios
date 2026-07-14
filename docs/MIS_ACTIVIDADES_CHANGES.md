# Cambios — Límite en "Mis actividades" y página "Ver todas"

Documentación de los cambios de código para la funcionalidad de **Mis
actividades**: tope de actividades visibles en las secciones de la pestaña
"Creadas" y página aparte para ver todas las de un tipo. Se documenta aquí para
poder revisar o comentar la funcionalidad por partes, en caso de que no se
implemente de una vez.

- Commit de la funcionalidad: `54c21bf`
- Integrado en `main` vía merge `4d8d7d9`
- Rama de origen: `feat/mis-actividades-ver-todas`

## Archivos modificados / creados

### 1. `apps/web/components/mis-actividades-client.tsx` (modificado)

- **Tope por sección — `MAX_CREATED_PER_SECTION = 5`**: constante que limita la
  cantidad de tarjetas mostradas en cada sección de la pestaña "Creadas".
- **`export interface Activity`**: se exporta la interfaz para reutilizarla en
  el componente de "ver todas".
- **`export function ActivityCard`**: se exporta la tarjeta para reutilizarla.
- **Componente `Section`**:
  - Nuevo prop `estado` (`pending | active | archived | cancelled`).
  - Cuando `isCreated` y la cantidad supera el tope, solo muestra las primeras 5
    (`items.slice(0, MAX_CREATED_PER_SECTION)`).
  - El título de la sección se vuelve un enlace a
    `/mis-actividades/todas?tab=created&estado={estado}`.
  - Debajo de la sección aparece "Ver todas (N)" cuando está limitada.
- **Llamadas a `Section`**: se pasa `estado` en cada una
  (Pendientes por confirmar → `pending`, Activas → `active`,
  Realizadas → `archived`, Canceladas → `cancelled`).

### 2. `apps/web/app/(app)/mis-actividades/todas/page.tsx` (nuevo)

Ruta `/mis-actividades/todas`. Lee `searchParams` (`tab`, `estado`), exige
sesión (`requireSession`) y renderiza `TodasActividadesClient`.

### 3. `apps/web/components/todas-actividades-client.tsx` (nuevo)

Cliente que carga la lista (`/api/v1/activities/mine` o `/enrolled` según
`tab`), la filtra por `estado` y muestra **todas** las actividades sin tope.
Reutiliza `ActivityCard` y mantiene las acciones (Administrar, Editar,
Realizada, Cancelar, Ceder cupo). Incluye enlace de vuelta a "Mis actividades".

## Cómo se puede dividir la revisión / implementación

- **Parte A — Límite visual en "Creadas"**: el tope y el `slice` en
  `mis-actividades-client.tsx`. No depende de la página "ver todas".
- **Parte B — Página "Ver todas"**: los archivos nuevos
  (`todas/page.tsx`, `todas-actividades-client.tsx`) y el enlace desde el título
  de sección. Depende de que `Activity` y `ActivityCard` estén exportados
  (Parte A o un commit previo debe exportarlos).

## Validación

- `tsc --noEmit`: sin errores.
- `next build`: exit 0; ruta `/mis-actividades/todas` presente en el output.

## Nota sobre el resto del pull

Los cambios de documentación (integración SEP y acceso de usuarios externos)
se integraron en `main` por separado en los merges `498511c` y `e8b9a7e`, y no
forman parte de esta funcionalidad de código.
