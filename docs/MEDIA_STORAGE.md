# Almacenamiento de imágenes y multimedia

**Estado:** Aprobado · **Fecha:** 2026-07-15 · **Responsable:** LDPG-coder

## Contexto

Hasta ahora todo el multimedia (fotos de perfil, constancias PDF, comprobantes
fotográficos de actividades e adjuntos de la incubadora) se guardaba **inline
como `data:` base64 dentro de columnas `Text` de PostgreSQL**. Eso producía:

- inflación de la base de datos y de los respaldos;
- payloads de API enormes (la incubadora cargaba **todos** los adjuntos con su
  base64 en cada lectura de proyecto);
- imposibilidad de servir con *streaming*/rangos y acoplamiento del binario a
  la transacción.

La tarea exige sacar los archivos de la BD y guardar **solo referencias**
(ruta, URL o identificador), y optimizar las consultas relacionadas.

## Opciones evaluadas

### A. Google Drive (cuenta del proyecto)

| Criterio | Evaluación |
|---|---|
| Costo | "Gratis" en almacenamiento, pero no está pensado para servir assets de app. |
| Escalabilidad | Pobre para muchas lecturas pequeñas: cuotas y *rate-limits* de la API. |
| Respaldo | Versionado/paper-trail, pero no alineado con las transacciones de la BD. |
| Rendimiento | Alta latencia, sin CDN para hotlink; obliga a proxy por la API. |

Conclusión: útil como **respaldo en frío** (vía `rclone`), no para servir en
caliente.

### B. Servidor local (volumen Docker) ✅

| Criterio | Evaluación |
|---|---|
| Costo | Incluido en el servidor actual; sin costo por request. |
| Escalabilidad | Limitada por el disco de un nodo; ampliable luego con objeto S3 detrás de la misma abstracción. |
| Respaldo | Fácil: snapshot del volumen o `rsync`/`rclone` a Drive/S3. |
| Rendimiento | Excelente lectura local; servido por la propia API autenticada. |

## Decisión

**Backend primario: sistema de archivos local** en un volumen del servidor
(`/data/media`), servido por la API autenticada en `GET /media/{id}`. La base
de datos guarda **únicamente una referencia** en la tabla `media_assets`
(ruta relativa, metadatos y dueño). Google Drive queda como destino de
respaldo en frío, no para servir.

La capa `app/storage` define un protocolo `MediaStorage`; hoy solo existe
`LocalFilesystemStorage`, pero el selector `get_storage()` permite enchufar en
el futuro un backend de objetos (S3/MinIO) o Drive **sin tocar las llamadas de
negocio**.

## Diseño

- `app/storage/` — abstracción (`MediaStorage`), implementación local y
  `service.py` (validación, decodificación de `data:`, escritura y registro).
- `media_assets` — tabla única de referencias:
  `id, tenant_id, owner_type, owner_id, kind, filename, content_type,
  byte_size, backend, reference, created_by, deleted_at`.
- Cada entidad gana una FK **nullable** al asset
  (`photo_asset_id`, `media_asset_id` en
  `activity_evidence` e `incubator_attachments`). La columna legada
  (`photo_url`, `image_url`, `data`) pasa a contener la
  **URL pública de referencia** (o el `data:` legacy hasta migrar).
- `GET /media/{asset_id}` — `StreamingResponse` autenticado, con `content-type`
  y soporte de *Range* para PDFs.

## Migración de datos

`scripts/migrate_media_to_storage.py` recorre las 4 entidades, decodifica el
base64 legado, persiste el archivo y reemplaza el valor por la URL de
referencia. Es **idempotente** (`--dry-run` disponible).

## Optimización de consultas

- Los listados ya no transportan el binario: devuelven URLs cortas.
- `_serialize_project` (incubadora) carga los adjuntos con `joinedload` del
  asset y excluye el peso del `data` base64 del payload.
- `media_assets` lleva índice compuesto `(owner_type, owner_id)`.

## Configuración (`.env`)

```
SISMO_MEDIA_STORAGE_BACKEND=local
SISMO_MEDIA_ROOT=/data/media
SISMO_MEDIA_PUBLIC_BASE_URL=https://api.sismo.lat/media
```

## Riesgos / notas

- Si una transacción de API revierte después de escribir el archivo, queda un
  archivo huérfano en el volumen; un *cron* de limpieza de `media_assets`
  huérfanos es seguimiento recomendado.
- El volumen `media_data` debe incluirse en la política de respaldo del host.
